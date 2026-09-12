// Seeded deterministic noise: the basis of layered geology. Same seed → same landform.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 100000) / 50000 - 1; // -1..1
}

export class ValueNoise2D {
  constructor(private seed = 1337) {}
  at(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, this.seed), b = hash2(ix + 1, iy, this.seed);
    const c = hash2(ix, iy + 1, this.seed), d = hash2(ix + 1, iy + 1, this.seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
}

export function fbm(n: ValueNoise2D, x: number, y: number, octaves: number, lacunarity = 2.02, gain = 0.5): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * n.at(x * freq, y * freq);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm; // -1..1
}

// Ridged multifractal: sharp crests + smooth valleys = mountain silhouettes, not spikes.
export function ridged(n: ValueNoise2D, x: number, y: number, octaves: number, lacunarity = 2.1, gain = 0.55): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const v = 1 - Math.abs(n.at(x * freq, y * freq));
    sum += amp * v * v;
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm; // 0..1
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
