// WorldStreamer — quadtree tile scheduler: region → required tiles → prioritized fetch → LRU evict.
// Phase 1: procedural heightfield tiles (real datasets plug in via TerrainSource in Phase 2).
import { FloatingOrigin, type LLA } from "../../../shared/src/geo.js";

export interface TileKey { z: number; x: number; y: number }
export const tileKey = (t: TileKey) => `${t.z}/${t.x}/${t.y}`;

export interface TerrainSource {
  heightM(lla: LLA): number;
}

// Deterministic pseudo-real terrain: continents-ish noise + latitude bands.
// (Replaced by dataset-backed source in Phase 2; same interface.)
export class ProceduralTerrain implements TerrainSource {
  heightM({ lat, lon }: LLA): number {
    const s = (f: number, a = 1, b = 0) => Math.sin(lat * f + b) * Math.cos(lon * f * 1.3 + a);
    let h = 600 * s(0.08, 1.7) + 900 * s(0.21, 0.4, 2.0) + 220 * s(0.55, 2.2, 0.7) + 60 * s(1.7, 0.2, 4.0);
    h += 1400 * Math.exp(-(((lat - 27) / 9) ** 2)) * Math.max(0, s(0.15, 0, 1)); // mountain belt hint
    const oceanMask = s(0.05, 4.2, 1.1) > 0.25 ? -1800 : 0; // cheap ocean basins
    return h + oceanMask;
  }
}

export class WorldStreamer {
  floating: FloatingOrigin;
  source: TerrainSource;
  loaded = new Map<string, { key: TileKey; center: LLA; mesh?: unknown; lastUsed: number }>();
  maxTiles = 64;
  lookAheadM = 2000;
  constructor(spawn: LLA, source: TerrainSource = new ProceduralTerrain()) {
    this.floating = new FloatingOrigin(spawn);
    this.source = source;
  }
  // Required tiles around player at LOD zoom from distance (simplified quadtree ring).
  requiredTiles(player: LLA, radius = 3): TileKey[] {
    const z = 12;
    const n = 2 ** z;
    const x = Math.floor(((player.lon + 180) / 360) * n);
    const y = Math.floor(((90 - player.lat) / 180) * n);
    const out: TileKey[] = [];
    for (let dx = -radius; dx <= radius; dx++)
      for (let dy = -radius; dy <= radius; dy++) {
        const dist = Math.hypot(dx, dy);
        if (dist > radius + 0.5) continue;
        out.push({ z, x: x + dx, y: y + dy });
      }
    return out.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)); // near-first
  }
  markUsed(keys: TileKey[], now = performance.now()) {
    for (const k of keys) {
      const e = this.loaded.get(tileKey(k));
      if (e) e.lastUsed = now;
      else this.loaded.set(tileKey(k), { key: k, center: { lat: 0, lon: 0, alt: 0 }, lastUsed: now });
    }
    // LRU evict distant
    if (this.loaded.size > this.maxTiles) {
      const sorted = [...this.loaded.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (let i = 0; i < this.loaded.size - this.maxTiles; i++) {
        this.loaded.delete(sorted[i][0]);
        this.onEvict?.(sorted[i][1].key);
      }
    }
  }
  onEvict?: (t: TileKey) => void;
  groundHeight(player: LLA): number {
    const h = this.source.heightM(player);
    return Math.max(h, -20); // ocean floor clamp for walking
  }
}
