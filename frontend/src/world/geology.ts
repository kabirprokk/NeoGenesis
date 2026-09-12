// WorldTerrainSystem + GeologySystem + ErosionSystem.
//
// Layered geological generation (every landform has a reason to exist):
//   1. Continental base — real elevation raster (earthData) or procedural fallback
//   2. Major structures — mountain mask from base altitude → ridged massifs, foothill aprons
//   3. Regional terrain — rolling fBm hills, plains flattening, plateau benches
//   4. Erosion — droplet hydraulic erosion (gullies/valleys/sediment) + thermal weathering
//   5. Drainage — rivers carved downhill, lakes trapped in basins (see hydrology.ts)
//   6. Local detail — micro displacement for close-range richness
import { ValueNoise2D, fbm, ridged, mulberry32, clamp01, smoothstep } from "./noise.js";
import type { LLA } from "../../../shared/src/geo.js";

export interface RiverTrace { pts: { x: number; z: number }[]; widths: number[]; flow: number }
export interface LakeBasin { x: number; z: number; r: number; yRel: number }

// Fast droplet hydraulic erosion on a height grid (meters). Carves gullies and
// valleys, deposits sediment on flats — geometry actually changes, not a texture.
export class ErosionSystem {
  static droplet(h: Float32Array, n: number, cell: number, count: number, rng: () => number): void {
    const at = (x: number, y: number) => h[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
    for (let d = 0; d < count; d++) {
      let x = 1 + rng() * (n - 3), y = 1 + rng() * (n - 3);
      let dx = 0, dy = 0, speed = 1, water = 1, sediment = 0;
      for (let s = 0; s < 24; s++) {
        const xi = Math.floor(x), yi = Math.floor(y);
        const fx = x - xi, fy = y - yi;
        const h00 = at(xi, yi), h10 = at(xi + 1, yi), h01 = at(xi, yi + 1), h11 = at(xi + 1, yi + 1);
        const gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
        const gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;
        dx = dx * 0.3 - gx * 0.7; dy = dy * 0.3 - gy * 0.7;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        x += dx; y += dy;
        if (x < 1 || x > n - 3 || y < 1 || y > n - 3) break;
        const hOld = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;
        const cap = Math.max(0.5, speed * Math.hypot(gx, gy) * 4) * water;
        if (sediment > cap || Math.hypot(gx, gy) < 0.0005) {
          const dep = (sediment - cap) * 0.3;
          sediment -= dep;
          const i0 = yi * n + xi;
          h[i0] += dep * (1 - fx) * (1 - fy); h[i0 + 1] += dep * fx * (1 - fy);
          h[i0 + n] += dep * (1 - fx) * fy; h[i0 + n + 1] += dep * fx * fy;
        } else {
          const ero = Math.min(0.6, (cap - sediment) * 0.35);
          sediment += ero;
          const i0 = yi * n + xi;
          h[i0] -= ero * (1 - fx) * (1 - fy); h[i0 + 1] -= ero * fx * (1 - fy);
          h[i0 + n] -= ero * (1 - fx) * fy; h[i0 + n + 1] -= ero * fx * fy;
        }
        speed = Math.sqrt(Math.max(0.1, speed * speed + Math.hypot(gx, gy) * -30 * cell));
        water *= 0.92;
        void hOld;
      }
    }
  }

  // Thermal weathering: loose material slides off slopes steeper than talus angle.
  static thermal(h: Float32Array, n: number, cell: number, talus = 0.75, iters = 2): void {
    for (let it = 0; it < iters; it++) {
      for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
        const i = y * n + x;
        const nb = [i - 1, i + 1, i - n, i + n];
        let total = 0;
        for (const j of nb) {
          const diff = h[i] - h[j];
          if (diff > talus * cell) total += (diff - talus * cell) * 0.12;
        }
        if (total > 0) {
          h[i] -= total;
          for (const j of nb) {
            const diff = h[i] + total - h[j];
            if (diff > 0) h[j] += total * 0.25;
          }
        }
      }
    }
  }
}

export class WorldTerrainSystem {
  readonly N = 129;             // grid resolution (129² verts)
  readonly extent = 600;        // meters across the patch
  heights = new Float32Array(129 * 129);   // absolute meters
  moisture = new Float32Array(129 * 129);  // 0..1 water availability
  rivers: RiverTrace[] = [];
  lakes: LakeBasin[] = [];
  centerH = 0;
  // Spawn-anchored local frame (meters, ENU of `ref`): grid center in world coords.
  // Vertices, rivers, lakes, and scatter all live here, so walking never detaches
  // the player from the terrain. Vertical datum (spawn height) unifies feet/ground/water.
  cx = 0; cz = 0;
  datumH: number | null = null;
  private geo = new ValueNoise2D(4242);
  private det = new ValueNoise2D(9182);

  cell(): number { return this.extent / (this.N - 1); }
  private li(x: number): number { return ((x - this.cx) / this.extent + 0.5) * (this.N - 1); }

  rebuild(center: LLA, base: (lla: LLA) => number, rainMmH: number, seed: number, ref: LLA): void {
    const { N } = this;
    const rng = mulberry32(seed);
    const mPerDegLat = 111320, mPerDegLon = 111320 * Math.cos((center.lat * Math.PI) / 180);
    const mLonRef = 111320 * Math.cos((ref.lat * Math.PI) / 180);
    this.cx = (center.lon - ref.lon) * mLonRef;
    this.cz = -(center.lat - ref.lat) * mPerDegLat;
    const wSeedX = rng() * 1000, wSeedY = rng() * 1000;

    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const gx = (i / (N - 1) - 0.5) * this.extent;
      const gz = (j / (N - 1) - 0.5) * this.extent;
      const lla: LLA = { lat: center.lat + -gz / mPerDegLat, lon: center.lon + gx / mPerDegLon, alt: 0 };
      const b = base(lla);
      const wx = wSeedX + gx / this.extent * 6, wy = wSeedY + gz / this.extent * 6;
      // Mountain mask from continental base → massifs only where geology puts them.
      const massif = smoothstep(500, 2200, b);
      const ocean = b < 0.5 ? 1 : 0;
      let h = b;
      h += fbm(this.geo, wx * 0.5, wy * 0.5, 4) * 26 * (1 - ocean * 0.9);            // regional hills
      h += (ridged(this.geo, wx * 1.4 + 9, wy * 1.4, 4) - 0.55) * 130 * massif;      // ridged massifs
      h += smoothstep(300, 900, b) * (1 - smoothstep(900, 1600, b)) * 14 *          // foothill apron
        (0.5 + 0.5 * fbm(this.det, wx * 2, wy * 2, 3));
      h += fbm(this.det, wx * 6, wy * 6, 3) * (2.2 + massif * 9);                    // local detail
      h += this.det.at(wx * 24, wy * 24) * 0.35;                                    // micro displacement
      if (ocean) h = b + fbm(this.geo, wx, wy, 2) * 2;                              // calm seabed
      this.heights[j * N + i] = h;
    }
    this.centerH = this.heights[Math.floor(N / 2) * N + Math.floor(N / 2)];
    if (this.datumH === null) this.datumH = this.centerH;

    ErosionSystem.droplet(this.heights, N, this.cell(), 260, rng);
    ErosionSystem.thermal(this.heights, N, this.cell());
    this.traceRivers(rng);
    this.computeMoisture(rainMmH, rng);
  }

  private hAt(ix: number, iy: number): number {
    const { N } = this;
    return this.heights[Math.min(N - 1, Math.max(0, iy)) * N + Math.min(N - 1, Math.max(0, ix))];
  }

  // Rivers: sources on high ground → gradient descent with flow accumulation → sea or lake.
  private traceRivers(rng: () => number): void {
    const { N } = this;
    this.rivers = []; this.lakes = [];
    const starts: { x: number; y: number }[] = [];
    for (let k = 0; k < 400 && starts.length < 3; k++) {
      const x = 8 + Math.floor(rng() * (N - 16)), y = 8 + Math.floor(rng() * (N - 16));
      if (this.hAt(x, y) > this.centerH + 12 && this.hAt(x, y) > 8) starts.push({ x, y });
    }
    for (const s of starts) {
      let fx = s.x, fy = s.y, flow = 1;
      const pts: { x: number; z: number }[] = [], widths: number[] = [];
      let trapped = 0;
      for (let step = 0; step < 220; step++) {
        const xi = Math.round(fx), yi = Math.round(fy);
        const hC = this.hAt(xi, yi);
        if (hC <= 0.4) break; // reached the sea
        // Steepest descent among 8 neighbors
        let bx = 0, by = 0, best = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const d = (hC - this.hAt(xi + ox, yi + oy)) / Math.hypot(ox, oy);
          if (d > best) { best = d; bx = ox; by = oy; }
        }
        if (best <= 0.0004) { trapped++; if (trapped > 6) break; else { fx += (rng() - 0.5); fy += (rng() - 0.5); continue; } }
        trapped = 0;
        fx += bx * 0.9; fy += by * 0.9;
        if (fx < 2 || fx > N - 3 || fy < 2 || fy > N - 3) break;
        flow += 0.35;
        const gx = (fx / (N - 1) - 0.5) * this.extent, gz = (fy / (N - 1) - 0.5) * this.extent;
        pts.push({ x: this.cx + gx, z: this.cz + gz });
        widths.push(Math.min(5, 1.1 + flow * 0.06));
        // Carve channel + muddy banks; width grows with accumulated flow.
        const wCells = widths[widths.length - 1] / this.cell();
        const r = Math.ceil(wCells * 1.6);
        for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
          const dd = Math.hypot(ox, oy);
          if (dd > r) continue;
          const ix = Math.round(fx) + ox, iy = Math.round(fy) + oy;
          if (ix < 1 || ix > N - 2 || iy < 1 || iy > N - 2) continue;
          const carve = dd < wCells * 0.5 ? 1.4 + flow * 0.02 : 0.35;
          this.heights[iy * N + ix] -= carve * (1 - dd / (r + 1));
        }
      }
      if (pts.length > 12) {
        this.rivers.push({ pts, widths, flow });
      } else if (pts.length > 4 && trapped > 6) {
        // No outlet → mountain lake basin.
        const last = pts[pts.length - 1];
        this.lakes.push({ x: last.x, z: last.z, r: 8 + flow * 0.4, yRel: 0 });
      }
    }
  }

  private computeMoisture(rainMmH: number, rng: () => number): void {
    const { N } = this;
    const rainBase = clamp01(0.18 + rainMmH / 14);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const gx = (i / (N - 1) - 0.5) * this.extent, gz = (j / (N - 1) - 0.5) * this.extent;
      const ax = this.cx + gx, az = this.cz + gz; // spawn-ENU: rivers/lakes live here
      let m = rainBase * 0.6 + 0.2 * (0.5 + 0.5 * fbm(this.geo, gx * 0.02, gz * 0.02, 3));
      const h = this.heights[j * N + i] - this.centerH;
      if (h < 1.2) m += 0.45; // shoreline / seabed damp
      for (const r of this.rivers) {
        // cheap: only nearby rivers matter; rivers store pts — check bounding stride
        for (let k = 0; k < r.pts.length; k += 3) {
          const dd = Math.hypot(r.pts[k].x - ax, r.pts[k].z - az);
          if (dd < 9) { m += 0.5 * (1 - dd / 9); break; }
        }
      }
      for (const l of this.lakes) {
        const dd = Math.hypot(l.x - ax, l.z - az);
        if (dd < l.r + 8) m += 0.4;
      }
      this.moisture[j * N + i] = clamp01(m + rng() * 0.04);
    }
    void rng;
  }

  // Bilinear absolute height at local meters.
  heightAtLocal(x: number, z: number): number {
    const { N } = this;
    const fx = this.li(x), fy = this.li(z);
    const x0 = Math.min(N - 2, Math.max(0, Math.floor(fx))), y0 = Math.min(N - 2, Math.max(0, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0)), ty = Math.min(1, Math.max(0, fy - y0));
    const i = y0 * N + x0;
    return this.heights[i] * (1 - tx) * (1 - ty) + this.heights[i + 1] * tx * (1 - ty)
         + this.heights[i + N] * (1 - tx) * ty + this.heights[i + N + 1] * tx * ty;
  }
  rel(x: number, z: number): number { return this.heightAtLocal(x, z) - (this.datumH ?? this.centerH); }
  moistureAt(x: number, z: number): number {
    const { N } = this;
    const fx = Math.min(N - 1.001, Math.max(0, this.li(x))), fy = Math.min(N - 1.001, Math.max(0, this.li(z)));
    return this.moisture[Math.floor(fy) * N + Math.floor(fx)];
  }
  // Gradient magnitude (rise over run) — drives rock exposure, scree, runoff.
  slopeAt(x: number, z: number): number {
    const c = this.cell() * 2;
    const dx = this.heightAtLocal(x + c, z) - this.heightAtLocal(x - c, z);
    const dz = this.heightAtLocal(x, z + c) - this.heightAtLocal(x, z - c);
    return Math.hypot(dx, dz) / (2 * c);
  }
  waterYRel(): number { return 0.4 - (this.datumH ?? this.centerH); } // absolute sea 0.4 m → world frame
}
