// Local terrain patch: heightfield around player, rebuilt on move (Phase 2 streams real tiles).
import * as THREE from "three";
import type { TerrainSource } from "./WorldStreamer.js";
import type { LLA } from "../../../shared/src/geo.js";

const SIZE = 96, SEG = 96, EXTENT_M = 600; // 600 m patch

export class TerrainPatch {
  mesh: THREE.Mesh;
  geo: THREE.PlaneGeometry;
  constructor(private source: TerrainSource, mat?: THREE.Material) {
    this.geo = new THREE.PlaneGeometry(EXTENT_M, EXTENT_M, SEG, SEG);
    this.geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(this.geo,
      mat ?? new THREE.MeshStandardMaterial({ color: 0x3d5a34, roughness: 1 }));
    this.mesh.receiveShadow = true;
  }
  rebuild(player: LLA, toLocal: (lla: LLA) => { x: number; z: number }, groundAt: (lla: LLA) => number) {
    const pos = this.geo.attributes.position;
    const mPerDegLat = 111320, mPerDegLon = 111320 * Math.cos((player.lat * Math.PI) / 180);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const lla: LLA = { lat: player.lat + (-z) / mPerDegLat, lon: player.lon + x / mPerDegLon, alt: 0 };
      pos.setY(i, groundAt(lla) - groundAt(player));
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    void toLocal;
  }
}

export function groundColorFor(biome: string): number {
  switch (biome) {
    case "jungle": return 0x1f4a24;
    case "forest": return 0x2f5230;
    case "grassland": return 0x5a7038;
    case "desert": return 0xb59a5e;
    case "tundra": return 0x8a9387;
    case "ice-sheet": return 0xdfe8ec;
    case "boreal": return 0x2c4636;
    case "wetland": return 0x33543a;
    default: return 0x3d5a34;
  }
}
