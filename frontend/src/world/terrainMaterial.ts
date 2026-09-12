// TerrainMaterialSystem — physically believable ground: per-vertex blending of
// grass/dirt/mud/sand/rock/snow by slope × altitude × moisture × temperature × biome,
// plus macro detail texture (no visible tiling) and storm wetness response.
import * as THREE from "three";
import type { WorldTerrainSystem } from "./geology.js";
import { clamp01, lerp } from "./noise.js";

type RGB = [number, number, number];
const C = {
  grassDry: [0.42, 0.44, 0.2] as RGB, grassLush: [0.16, 0.32, 0.12] as RGB,
  dirt: [0.36, 0.27, 0.17] as RGB, mud: [0.23, 0.17, 0.11] as RGB,
  sand: [0.76, 0.66, 0.46] as RGB, wetSand: [0.5, 0.42, 0.29] as RGB,
  rock: [0.42, 0.4, 0.37] as RGB, rockDark: [0.26, 0.25, 0.24] as RGB,
  scree: [0.5, 0.46, 0.4] as RGB, snow: [0.88, 0.9, 0.93] as RGB,
  seabed: [0.32, 0.36, 0.3] as RGB, deepbed: [0.1, 0.14, 0.16] as RGB,
};
const mix = (a: RGB, b: RGB, t: number): RGB =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const vary = (c: RGB, amt: number, r: number): RGB =>
  [c[0] * (1 + (r - 0.5) * amt), c[1] * (1 + (r - 0.5) * amt), c[2] * (1 + (r - 0.5) * amt)];

function detailTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const n = 0.82 + 0.18 * Math.sin(i * 0.7) * Math.sin(j * 0.9)
      + 0.08 * Math.sin(i * 0.13 + j * 0.21) + 0.05 * Math.sin(i * 1.7 - j * 1.3);
    const o = (j * S + i) * 4;
    const v = Math.round(255 * Math.min(1.15, Math.max(0.7, n)));
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(48, 48);
  return t;
}

export class TerrainMaterialSystem {
  material: THREE.MeshStandardMaterial;
  private wet = 0;

  constructor() {
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true, map: detailTexture(), roughness: 0.96, metalness: 0,
    });
  }

  // Snowline follows temperature: freezing lowlands in ice-age, high peaks in greenhouse.
  paint(sys: WorldTerrainSystem, geo: THREE.BufferGeometry, opts: { biome: string; tempC: number; seed: number }): void {
    const pos = geo.attributes.position;
    // Reuse the color buffer across rebuilds — no per-tick GPU reallocations.
    const existing = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
    const colors = existing && existing.count === pos.count
      ? (existing.array as Float32Array)
      : new Float32Array(pos.count * 3);
    const sea = sys.waterYRel();
    const snowline = Math.min(5200, Math.max(500, 3400 - (24 - opts.tempC) * 160));
    let s = opts.seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s % 1000) / 1000; };
    const jungle = opts.biome === "jungle" || opts.biome === "forest" || opts.biome === "wetland";
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v);
      const h = sys.rel(x, z);
      const absH = h + sys.centerH;
      const slope = sys.slopeAt(x, z);
      const moist = sys.moistureAt(x, z);
      let col: RGB;
      if (h < sea - 6) col = mix(C.seabed, C.deepbed, clamp01((sea - h) / 30));
      else if (h < sea + 1.1) col = moist > 0.5 ? C.wetSand : C.sand;          // beach / wet sand band
      else {
        const grass = mix(C.grassDry, C.grassLush, clamp01(moist * 1.2));
        col = mix(C.dirt, grass, clamp01(0.35 + moist * 0.8 - slope * 0.5));
        if (jungle) col = mix(col, C.grassLush, 0.45);
        if (moist > 0.75 && slope < 0.3) col = mix(col, C.mud, 0.55);          // floodplain mud
        if (slope > 0.42 && slope <= 0.62 && absH > 400) col = mix(col, C.scree, 0.6); // scree slopes
        if (slope > 0.55 || absH > 2600) col = mix(mix(col, C.rock, 0.75), C.rockDark, clamp01((slope - 0.55) * 2)); // exposed rock/cliffs
        if (absH > snowline) col = mix(col, C.snow, clamp01((absH - snowline) / 400));  // snowfields
      }
      col = vary(col, 0.22, rnd()); // per-vertex imperfection — no flat gamey fills
      colors[v * 3] = col[0]; colors[v * 3 + 1] = col[1]; colors[v * 3 + 2] = col[2];
    }
    if (existing && existing.count === pos.count) {
      existing.needsUpdate = true;
    } else {
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
  }

  // Rain darkens soil/rock and drops roughness response — storms visibly change the world.
  setWetness(w: number): void {
    this.wet = w;
    const k = 1 - 0.38 * clamp01(w);
    this.material.color.setRGB(k, k, k * 1.01);
    this.material.roughness = 0.96 - 0.35 * clamp01(w);
  }
  get wetness(): number { return this.wet; }
}
