// Long-term climate: f(lat, alt, coast, season, atmosphere, terrain) → envelopes.
import type { WorldEraConfig } from "./era.js";

export interface ClimateInput { lat: number; altM: number; coastDistKm: number; dayOfYear: number; slope?: number }
export interface ClimateOutput { tempC: number; precipMmYr: number; humidity01: number; vegetationSuitability01: number; habitatSuitability01: number; biome: string }

export function climateFor(cfg: WorldEraConfig, inp: ClimateInput): ClimateOutput {
  const latR = Math.abs(inp.lat) * Math.PI / 180;
  const seasonal = Math.cos(((inp.dayOfYear - (inp.lat >= 0 ? 200 : 20)) / 365) * 2 * Math.PI);
  const greenhouse = (cfg.atmosphere.co2ppm - 280) / 720; // 0 preindustrial → ~1 default
  let tempC = 30 * Math.cos(latR) ** 1.4 + 4 * greenhouse - 6.5 * (inp.altM / 1000);
  tempC += seasonal * (inp.lat >= 0 ? 1 : -1) * (8 + 14 * Math.sin(latR)) * (cfg.iceSheets ? 1.6 : 1);
  // Ocean moderation
  tempC += Math.max(0, 1 - inp.coastDistKm / 400) * 2 * Math.sign(30 - tempC || 1) * 0.5;
  if (cfg.iceSheets && Math.abs(inp.lat) > 55) tempC -= 18;
  // Precipitation: ITCZ + midlatitude storm tracks + orographic + aridity belts
  let precip = 2200 * Math.exp(-(((Math.abs(inp.lat) - 5) / 18) ** 2))
    + 1200 * Math.exp(-(((Math.abs(inp.lat) - 55) / 20) ** 2))
    + 400 * Math.exp(-(((Math.abs(inp.lat) - 25) / 9) ** 2)) * 0.25;
  precip *= Math.exp(-Math.max(0, inp.altM) / 9000) + (inp.slope ? Math.min(0.6, inp.slope * 2) : 0);
  precip *= 1 + 0.25 * greenhouse;
  if (cfg.iceSheets && Math.abs(inp.lat) > 60) precip *= 0.6;
  const humidity01 = Math.min(1, Math.max(0, precip / 2500));
  const veg = Math.min(1, Math.max(0, (precip / 1600) * tempFactor(tempC)));
  const biome = classifyBiome(tempC, precip, inp.altM, cfg);
  return { tempC, precipMmYr: Math.round(precip), humidity01,
    vegetationSuitability01: veg, habitatSuitability01: veg * 0.8 + 0.2 * (1 - Math.abs(tempC - 22) / 40),
    biome };
}

function tempFactor(t: number): number {
  if (t < -10 || t > 45) return 0.05;
  if (t < 5) return 0.3 + (t + 10) / 15 * 0.4;
  if (t <= 30) return 0.9 + 0.1 * Math.sin((t - 5) / 25 * Math.PI);
  return 0.9 - (t - 30) / 15 * 0.5;
}

export function classifyBiome(tempC: number, precip: number, altM: number, cfg: WorldEraConfig): string {
  if (cfg.iceSheets && (tempC < -8 || (Math.abs(altM) > 2500 && tempC < 0))) return tempC < -20 ? "ice-sheet" : "tundra";
  if (!cfg.iceSheets && altM > 4500) return "alpine";
  if (tempC > 24 && precip > 1800) return "jungle";
  if (tempC > 20 && precip > 1000) return "forest";
  if (tempC > 18 && precip > 500) return "grassland";
  if (precip < 250) return tempC > 20 ? "desert" : "cold-desert";
  if (tempC < 5) return "boreal";
  if (precip > 700) return "wetland";
  return "shrubland";
}
