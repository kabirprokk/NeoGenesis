// FarField (WorldLODSystem, far tier): coarse 40 km terrain ring around the player so the
// horizon shows real landforms fading into atmosphere instead of a black void.
// Same spawn-anchored frame as the near patch; rebuilt only after kilometers of travel.
import * as THREE from "three";
import type { LLA } from "../../../shared/src/geo.js";

export class FarField {
  mesh: THREE.Mesh;
  private geo: THREE.PlaneGeometry;
  private N = 96;
  extent = 40000;
  private clat = 1e9; private clon = 1e9;

  constructor() {
    this.geo = new THREE.PlaneGeometry(this.extent, this.extent, this.N - 1, this.N - 1);
    this.geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(this.geo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
    this.mesh.frustumCulled = true;
  }

  needsRebuild(lat: number, lon: number): boolean {
    return Math.hypot((lat - this.clat) * 111320, (lon - this.clon) * 111320) > 4000;
  }

  rebuild(center: LLA, ref: LLA, base: (lla: LLA) => number, datumH: number): void {
    this.clat = center.lat; this.clon = center.lon;
    const { N } = this;
    const mLat = 111320, mLonC = 111320 * Math.cos((center.lat * Math.PI) / 180);
    const mLonRef = 111320 * Math.cos((ref.lat * Math.PI) / 180);
    const cx = (center.lon - ref.lon) * mLonRef, cz = -(center.lat - ref.lat) * mLat;
    const pos = this.geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const v = j * N + i;
      const ox = (i / (N - 1) - 0.5) * this.extent, oz = (j / (N - 1) - 0.5) * this.extent;
      const lla: LLA = { lat: center.lat + -oz / mLat, lon: center.lon + ox / mLonC, alt: 0 };
      const h = base(lla);
      pos.setX(v, cx + ox); pos.setZ(v, cz + oz);
      pos.setY(v, h - datumH);
      // Cheap elevation-band colors — fog and distance do the rest.
      let r: number, g: number, b: number;
      if (h < 0.5) { const k = Math.min(1, -h / 2000); r = 0.1 + 0.1 * (1 - k); g = 0.16 + 0.1 * (1 - k); b = 0.2 + 0.08 * (1 - k); }
      else if (h < 2) { r = 0.72; g = 0.62; b = 0.44; }
      else if (h < 1200) { r = 0.2; g = 0.32; b = 0.14; }
      else if (h < 2600) { r = 0.4; g = 0.38; b = 0.34; }
      else { r = 0.82; g = 0.84; b = 0.87; }
      colors[v * 3] = r; colors[v * 3 + 1] = g; colors[v * 3 + 2] = b;
    }
    pos.needsUpdate = true;
    this.geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
