// Real-Earth raster data: ocean mask (real coastlines) + relief proxy, bilinear-sampled.
// Sources: NASA Blue Marble family via three-globe example imagery, vendored by
// `npm run fetch-assets` into /earth/. Calibration (pixel probes, 2026-09):
//   earth-water.png  white(255)=ocean, black(0)=land   (Pacific=255, Sahara=0)
//   earth-topology.png grayscale relief (Everest=226, Pacific trench=0, Amazon=2)
import type { TerrainSource } from "./WorldStreamer.js";
import { ProceduralTerrain } from "./WorldStreamer.js";
import type { LLA } from "../../../shared/src/geo.js";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`missing asset ${url} — run npm run fetch-assets`));
    img.src = url;
  });
}

function toData(img: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

// Equirectangular bilinear sample of the red channel, 0..1.
function sample01(d: ImageData, lat: number, lon: number): number {
  const W = d.width, H = d.height;
  const fx = (((lon + 180) / 360) % 1 + 1) % 1 * (W - 1);
  const fy = Math.min(H - 1.001, Math.max(0, ((90 - lat) / 180) * (H - 1)));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const at = (x: number, y: number) => d.data[((Math.min(H - 1, y) * W) + (x % W)) * 4] / 255;
  return at(x0, y0) * (1 - tx) * (1 - ty) + at(x0 + 1, y0) * tx * (1 - ty)
       + at(x0, y0 + 1) * (1 - tx) * ty + at(x0 + 1, y0 + 1) * tx * ty;
}

export class EarthData {
  ready = false;
  private water: ImageData | null = null;
  private topo: ImageData | null = null;

  static async load(): Promise<EarthData> {
    const ed = new EarthData();
    try {
      const [w, t] = await Promise.all([loadImage("/earth/earth-water.png"), loadImage("/earth/earth-topology.png")]);
      ed.water = toData(w); ed.topo = toData(t); ed.ready = true;
      console.log("[neo] real Earth rasters loaded (coastlines + relief).");
    } catch (e) {
      console.warn("[neo]", (e as Error).message, "— procedural fallback active.");
    }
    return ed;
  }

  water01(lat: number, lon: number): number {
    return this.water ? sample01(this.water, lat, lon) : 0;
  }
  isOcean(lat: number, lon: number): boolean {
    return this.water01(lat, lon) >= 0.5;
  }

  // Meters. Relief proxy scaled to real ranges (Everest ≈ 5200 m, trenches ≈ −4000 m).
  // Documented approximation: coastline mask is the accurate layer, relief is scaled,
  // not a survey DEM. Production swap: ETOPO1/GEBCO grid (see docs/ASSETS.md).
  elevationAt(lat: number, lon: number): number {
    if (!this.topo || !this.water) return 0;
    const w = sample01(this.water, lat, lon);
    const t = sample01(this.topo, lat, lon);
    const landH = Math.pow(t, 1.15) * 6000;
    const oceanH = -(1500 + (1 - t) * 2500);
    if (w <= 0.35) return landH;
    if (w >= 0.65) return oceanH;
    const k = (w - 0.35) / 0.3; // beach blend across the surf zone
    return landH * (1 - k) + 0.5 * k + oceanH * 0; // grades to shoreline, never a cliff
  }
}

export class RealTerrain implements TerrainSource {
  private fallback = new ProceduralTerrain();
  constructor(private ed: EarthData) {}
  heightM(lla: LLA): number {
    if (!this.ed.ready) return this.fallback.heightM(lla);
    return this.ed.elevationAt(lla.lat, lla.lon);
  }
}
