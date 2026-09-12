// Local terrain patch: WorldTerrainSystem grid → mesh + water extras, rebuilt on move.
// Detail near the player, geographically correct at distance (WorldStreamer owns far LOD).
import * as THREE from "three";
import { WorldTerrainSystem } from "../world/geology.js";
import { TerrainMaterialSystem } from "../world/terrainMaterial.js";
import { RiverSystem, LakeSystem, OceanSystem, disposeExtras } from "../world/hydrology.js";
import type { LLA } from "../../../shared/src/geo.js";

export interface PatchOpts {
  base: (lla: LLA) => number;   // continental elevation sampler (real raster / procedural)
  rainMmH: number; tempC: number; biome: string; seed: number;
}

export class TerrainPatch {
  mesh: THREE.Mesh;
  extras = new THREE.Group(); // foam, river ribbons, lake discs
  sys = new WorldTerrainSystem();
  private geo: THREE.PlaneGeometry;
  private mats: TerrainMaterialSystem;
  private flowMats: THREE.MeshStandardMaterial[] = [];

  constructor() {
    const SEG = this.sys.N - 1;
    this.geo = new THREE.PlaneGeometry(this.sys.extent, this.sys.extent, SEG, SEG);
    this.geo.rotateX(-Math.PI / 2);
    this.mats = new TerrainMaterialSystem();
    this.mesh = new THREE.Mesh(this.geo, this.mats.material);
    this.mesh.receiveShadow = true;
  }

  rebuild(center: LLA, opts: PatchOpts & { ref: LLA }): void {
    this.sys.rebuild(center, opts.base, opts.rainMmH, opts.seed, opts.ref);
    // Vertices in spawn-anchored world meters: the mesh sits at origin forever,
    // and the walking player (same frame) can never leave the ground behind.
    const pos = this.geo.attributes.position;
    const N = this.sys.N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const v = j * N + i;
      const ax = this.sys.cx + (i / (N - 1) - 0.5) * this.sys.extent;
      const az = this.sys.cz + (j / (N - 1) - 0.5) * this.sys.extent;
      pos.setX(v, ax); pos.setZ(v, az);
      pos.setY(v, this.sys.rel(ax, az));
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.mats.paint(this.sys, this.geo, { biome: opts.biome, tempC: opts.tempC, seed: opts.seed });
    this.mats.setWetness(opts.rainMmH > 0.5 ? 1 : 0);

    // Water extras follow carved hydrology.
    disposeExtras(this.extras);
    this.flowMats = [];
    this.extras.add(OceanSystem.buildFoam(this.sys));
    for (const r of this.sys.rivers) {
      const g = RiverSystem.buildRibbon(r, this.sys);
      if (g.userData.mat) this.flowMats.push(g.userData.mat as THREE.MeshStandardMaterial);
      this.extras.add(g);
    }
    for (const l of this.sys.lakes) this.extras.add(LakeSystem.buildDisc(l, this.sys));
  }

  setWetness(w: number): void { this.mats.setWetness(w); }
  waterYRel(): number { return this.sys.waterYRel(); }

  tick(dt: number, t: number): void {
    for (const m of this.flowMats) {
      const tex = m.map as THREE.Texture | null;
      if (tex) tex.offset.y = (t * 0.25) % 1; // downstream flow
    }
    void dt;
  }
}
