// VegetationSystem + RockSystem + EnvironmentAssetSystem.
//
// No uniform scattering: placement is moisture/biome/slope-clustered with layered
// structure (canopy → understory → shrubs → grass → litter). Every instance gets
// mesh/scale/rotation/color variation — 5,000 trees never look like one tree × 5,000.
import * as THREE from "three";
import type { WebGLProgramParametersWithUniforms } from "three";
import type { WorldTerrainSystem } from "./geology.js";
import { mulberry32, clamp01 } from "./noise.js";

// Shared variation helpers (EnvironmentAssetSystem).
export const AssetVar = {
  pick<T>(rng: () => number, arr: T[]): T { return arr[Math.floor(rng() * arr.length) % arr.length]; },
  tint(base: THREE.Color, rng: () => number, amt: number): THREE.Color {
    const k = 1 + (rng() - 0.5) * amt;
    return new THREE.Color(base.r * k, base.g * k, base.b * k);
  },
  yaw(rng: () => number): number { return rng() * Math.PI * 2; },
};

// Rebuilds run every few seconds — dispose GPU resources or the heap bleeds out.
export function disposeGroup(gr: THREE.Group): void {
  gr.traverse((o) => {
    const m = o as unknown as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mm of mats) mm.dispose();
  });
  gr.clear();
}

export interface ScatterOpts { biome: string; tempC: number; seed: number }

const DENSITY: Record<string, { tree: number; shrub: number; grass: number }> = {
  jungle: { tree: 300, shrub: 420, grass: 2600 },
  forest: { tree: 240, shrub: 330, grass: 2000 },
  wetland: { tree: 150, shrub: 260, grass: 2400 },
  grassland: { tree: 60, shrub: 200, grass: 3200 },
  shrubland: { tree: 30, shrub: 260, grass: 1500 },
  desert: { tree: 8, shrub: 90, grass: 250 },
  tundra: { tree: 5, shrub: 120, grass: 900 },
  boreal: { tree: 200, shrub: 200, grass: 1200 },
  "ice-sheet": { tree: 0, shrub: 10, grass: 60 },
  "cold-desert": { tree: 4, shrub: 60, grass: 200 },
  alpine: { tree: 15, shrub: 120, grass: 700 },
};

export interface FloraExtra {
  broad?: THREE.BufferGeometry;    // dropped-in broadleaf/palm mesh (replaces blobs)
  coniferGeo?: THREE.BufferGeometry; // dropped-in conifer mesh for cold biomes
  colliders?: { x: number; z: number; r: number }[]; // filled: solid trunks
}

export class VegetationSystem {
  group = new THREE.Group();
  private uTime = { value: 0 };

  build(sys: WorldTerrainSystem, opts: ScatterOpts, extra?: FloraExtra): void {
    disposeGroup(this.group);
    const d = DENSITY[opts.biome] ?? DENSITY.grassland;
    const rng = mulberry32(opts.seed);
    const sea = sys.waterYRel();
    const snow = opts.tempC < 1;

    // Cluster centers weighted to moist ground — groves, not grids.
    const clusters: { x: number; z: number; r: number }[] = [];
    for (let k = 0; k < 26; k++) {
      const x = sys.cx + (rng() - 0.5) * sys.extent * 0.94, z = sys.cz + (rng() - 0.5) * sys.extent * 0.94;
      const m = sys.moistureAt(x, z);
      if (m > 0.34 && sys.rel(x, z) > sea + 0.4 && sys.slopeAt(x, z) < 0.5) {
        clusters.push({ x, z, r: 12 + rng() * 30 });
      }
    }
    const nearCluster = (x: number, z: number) =>
      clusters.some((c) => Math.hypot(c.x - x, c.z - z) < c.r);

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const conifer = opts.biome === "boreal" || opts.biome === "tundra" || opts.tempC < 6;

    // L1 canopy: two meshes (broadleaf blobs + conifer spires) with per-instance color.
    // Dropped-in GLB geometry (see docs/MODELS_NEEDED.md) replaces the primitives 1:1.
    const leafGeo = (conifer ? extra?.coniferGeo : extra?.broad) ?? new THREE.IcosahedronGeometry(2.2, 1);
    const leafMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    const leaf = new THREE.InstancedMesh(leafGeo, leafMat, Math.max(1, d.tree));
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.4, 3.4, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
    const trunk = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(1, d.tree));
    let ti = 0;
    for (let k = 0; k < d.tree * 3 && ti < d.tree; k++) {
      const x = sys.cx + (rng() - 0.5) * sys.extent * 0.94, z = sys.cz + (rng() - 0.5) * sys.extent * 0.94;
      const h = sys.rel(x, z), slope = sys.slopeAt(x, z), m = sys.moistureAt(x, z);
      if (h < sea + 0.5 || slope > 0.55 || m < 0.3) continue;
      if (!nearCluster(x, z) && rng() > 0.18) continue; // outliers stay rare
      const s = 0.6 + rng() * 1.1;
      dummy.position.set(x, h - 0.2, z);
      dummy.rotation.set(0, AssetVar.yaw(rng), 0);
      dummy.scale.set(s * (0.8 + rng() * 0.5), s, s * (0.8 + rng() * 0.5));
      dummy.updateMatrix(); trunk.setMatrixAt(ti, dummy.matrix);
      dummy.position.y = h + 2.6 * s;
      dummy.scale.set(s * (conifer ? 0.7 : 1.15), s * (conifer ? 1.7 : 1), s * (conifer ? 0.7 : 1.15));
      dummy.updateMatrix(); leaf.setMatrixAt(ti, dummy.matrix);
      const g = snow ? col.setRGB(0.75, 0.78, 0.8)
        : conifer ? col.setRGB(0.1 + rng() * 0.06, 0.22 + rng() * 0.08, 0.1)
        : col.setRGB(0.14 + rng() * 0.14, 0.3 + rng() * 0.14, 0.1 + rng() * 0.06);
      leaf.setColorAt(ti, g);
      extra?.colliders?.push({ x, z, r: 0.55 * s }); // solid trunk
      ti++;
    }
    leaf.count = ti; trunk.count = ti;
    leaf.instanceMatrix.needsUpdate = true; trunk.instanceMatrix.needsUpdate = true;
    if (leaf.instanceColor) leaf.instanceColor.needsUpdate = true;
    leaf.castShadow = true;
    this.group.add(trunk, leaf);

    // L2 understory shrubs + ferns.
    const shrubGeo = new THREE.IcosahedronGeometry(0.8, 0);
    const shrubMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    const shrub = new THREE.InstancedMesh(shrubGeo, shrubMat, Math.max(1, d.shrub));
    let si = 0;
    for (let k = 0; k < d.shrub * 3 && si < d.shrub; k++) {
      const x = sys.cx + (rng() - 0.5) * sys.extent * 0.94, z = sys.cz + (rng() - 0.5) * sys.extent * 0.94;
      const h = sys.rel(x, z);
      if (h < sea + 0.3 || sys.slopeAt(x, z) > 0.7 || sys.moistureAt(x, z) < 0.25) continue;
      if (!nearCluster(x, z) && rng() > 0.4) continue;
      const s = 0.5 + rng() * 1.2;
      dummy.position.set(x, h + 0.3 * s, z);
      dummy.rotation.set(rng() * 0.4, AssetVar.yaw(rng), rng() * 0.4);
      dummy.scale.set(s, s * 0.7, s);
      dummy.updateMatrix(); shrub.setMatrixAt(si, dummy.matrix);
      shrub.setColorAt(si, col.setRGB(0.12 + rng() * 0.12, 0.28 + rng() * 0.14, 0.1 + rng() * 0.08));
      si++;
    }
    shrub.count = si;
    shrub.instanceMatrix.needsUpdate = true;
    if (shrub.instanceColor) shrub.instanceColor.needsUpdate = true;
    this.group.add(shrub);

    // L3 grass: thousands of wind-blown blades (crossed planes, shader sway).
    const bladeGeo = new THREE.PlaneGeometry(0.5, 0.9);
    bladeGeo.translate(0, 0.45, 0);
    const bladeMat = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide, roughness: 1,
      color: new THREE.Color(0.3, 0.42, 0.16),
    });
    const uTime = this.uTime;
    bladeMat.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms) => {
      sh.uniforms.uTime = uTime as unknown as THREE.IUniform;
      sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           float swayPh = float(gl_InstanceID) * 1.71;
           transformed.x += sin(uTime * 2.2 + swayPh) * 0.09 * smoothstep(0.0, 0.9, transformed.y);
           transformed.z += cos(uTime * 1.7 + swayPh * 1.3) * 0.06 * smoothstep(0.0, 0.9, transformed.y);
         #endif`
      );
    };
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, Math.max(1, d.grass));
    let gi = 0;
    for (let k = 0; k < d.grass * 2 && gi < d.grass; k++) {
      const x = sys.cx + (rng() - 0.5) * sys.extent * 0.94, z = sys.cz + (rng() - 0.5) * sys.extent * 0.94;
      const h = sys.rel(x, z);
      if (h < sea + 0.25 || sys.slopeAt(x, z) > 0.8) continue;
      const m = sys.moistureAt(x, z);
      if (m < 0.18 && rng() > 0.15) continue;
      const s = 0.6 + rng() * 1.1;
      dummy.position.set(x, h - 0.05, z);
      dummy.rotation.set(0, AssetVar.yaw(rng), 0);
      dummy.scale.set(s, s * (0.7 + m * 0.7), s);
      dummy.updateMatrix(); grass.setMatrixAt(gi, dummy.matrix);
      grass.setColorAt(gi, col.setRGB(0.24 + rng() * 0.2, 0.36 + rng() * 0.18, 0.12 + rng() * 0.08));
      gi++;
    }
    grass.count = gi;
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    this.group.add(grass);
  }

  tick(dt: number): void { this.uTime.value += dt; }
}

export interface RockExtra {
  geos?: THREE.BufferGeometry[]; // dropped-in boulder/rock meshes (replace primitives 1:1)
  colliders?: { x: number; z: number; r: number }[]; // filled: solid boulders
}

export class RockSystem {
  group = new THREE.Group();

  build(sys: WorldTerrainSystem, seed: number, extra?: RockExtra): void {
    disposeGroup(this.group);
    const rng = mulberry32(seed ^ 0x9e37);
    const sea = sys.waterYRel();
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const defs = [
      { geo: extra?.geos?.[0] ?? new THREE.IcosahedronGeometry(1.4, 1), n: 110, sMin: 0.5, sMax: 2.6, steep: true, solid: true },  // boulders
      { geo: extra?.geos?.[1] ?? new THREE.DodecahedronGeometry(0.5, 0), n: 260, sMin: 0.4, sMax: 1.4, steep: false, solid: false }, // stones
      { geo: new THREE.TetrahedronGeometry(0.16, 0), n: 500, sMin: 0.5, sMax: 1.6, steep: false, solid: false }, // pebbles/grit
    ];
    for (const d of defs) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
      const mesh = new THREE.InstancedMesh(d.geo, mat, d.n);
      let placed = 0;
      for (let k = 0; k < d.n * 4 && placed < d.n; k++) {
        const x = sys.cx + (rng() - 0.5) * sys.extent * 0.94, z = sys.cz + (rng() - 0.5) * sys.extent * 0.94;
        const h = sys.rel(x, z), slope = sys.slopeAt(x, z);
        const shore = Math.abs(h - sea) < 1.5;
        // Boulders favor steep/scree ground; pebbles favor shores and flats.
        if (d.steep ? (slope < 0.3 && !shore && rng() > 0.2) : (slope > 0.75 && rng() > 0.3)) continue;
        if (h < sea - 4) continue; // deep seabed stays clean
        const s = d.sMin + rng() * (d.sMax - d.sMin);
        dummy.position.set(x, h + s * 0.15, z);
        dummy.rotation.set(rng() * 3, AssetVar.yaw(rng), rng() * 3);
        dummy.scale.set(s * (0.6 + rng() * 0.9), s * (0.5 + rng() * 0.7), s * (0.6 + rng() * 0.9));
        dummy.updateMatrix(); mesh.setMatrixAt(placed, dummy.matrix);
        const v = 0.3 + rng() * 0.25;
        mesh.setColorAt(placed, shore ? col.setRGB(v + 0.12, v + 0.08, v) : col.setRGB(v, v * 0.97, v * 0.92));
        if (d.solid) extra?.colliders?.push({ x, z, r: s * 1.1 }); // solid boulder
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = true;
      this.group.add(mesh);
    }
  }
}
