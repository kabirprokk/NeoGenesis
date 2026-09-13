// Closed-form physics: every verdict bottoms out in these functions + the data tables.
// No tuning constants except where explicitly marked.
import { PHYSICS } from "./constants.js";
import { DRAG_CD } from "./materials.js";

export const fallSpeed = (g: number, t: number, v0 = 0) => v0 + g * t;
export const fallDistance = (g: number, t: number) => 0.5 * g * t * t;

/** Terminal velocity from quadratic drag equilibrium. Tables 1+13+18. */
export function terminalVelocity(massKg: number, cd: number, areaM2: number, fluidDensity = PHYSICS.AIR_DENSITY): number {
  return Math.sqrt((2 * massKg * PHYSICS.G_EARTH) / (fluidDensity * cd * areaM2));
}
/** Human belly-to-earth check: 80 kg, Cd 0.7, area 0.63 m² (CdA ≈ 0.44) → ≈ 54 m/s. */
export function humanTerminal(): number {
  return terminalVelocity(80, 0.7, 0.63);
}
/** Vacuum range of a projectile. */
export function projectileRange(vMs: number, angleDeg: number, g = PHYSICS.G_EARTH): number {
  const a = (angleDeg * Math.PI) / 180;
  return ((vMs * vMs) * Math.sin(2 * a)) / g;
}
/** Impact energy and impact pressure over a contact area. */
export function impact(massKg: number, vMs: number, contactAreaM2: number): { keJ: number; pressureMpa: number } {
  const keJ = 0.5 * massKg * vMs * vMs;
  return { keJ, pressureMpa: keJ / Math.max(1e-6, contactAreaM2) / 1e6 };
}
/** Mohs rule: harder scratches softer. Returns verdict string. */
export function mohsVerdict(aMohs: number, bMohs: number, aName: string, bName: string): string {
  if (aMohs > bMohs) return `${aName} (Mohs ${aMohs}) scratches ${bName} (Mohs ${bMohs}) — REAL.`;
  if (aMohs < bMohs) return `${aName} (Mohs ${aMohs}) cannot scratch ${bName} (Mohs ${bMohs}) — NOT REAL in reverse.`;
  return `Equal hardness (Mohs ${aMohs}) — mutual abrasion only.`;
}
/** Buoyancy verdict. Unknown when fluid density is absent. */
export function buoyancyVerdict(bodyDensity: number, fluidDensity: number | undefined, body: string, fluid: string): string {
  if (fluidDensity === undefined) return `No density data for ${fluid} — buoyancy UNKNOWN, viscosity drag only.`;
  if (bodyDensity < fluidDensity) return `${body} (${bodyDensity}) floats in ${fluid} (${fluidDensity}) — REAL.`;
  return `${body} (${bodyDensity}) sinks in ${fluid} (${fluidDensity}) — REAL (and fast if much denser).`;
}
/** Sound travel delay. Table 6. */
export function soundDelay(distM: number, mediumMs: number): number { return distM / mediumMs; }
/** Block on incline: slides if tan(angle) > muS. */
export function slidesOnIncline(muS: number, angleDeg: number): boolean {
  return Math.tan((angleDeg * Math.PI) / 180) > muS;
}
/** Repose check: granular pile stable below its repose range. */
export function reposeOk(repose: [number, number], angleDeg: number): string {
  if (angleDeg < repose[0]) return `Stable — below repose (${repose[0]}–${repose[1]}°).`;
  if (angleDeg <= repose[1]) return `Marginal — inside repose band, disturbance triggers slides.`;
  return `NOT REAL as static terrain — exceeds repose, it avalanches to ~${repose[1]}°.`;
}
/** Drag profile lookup with fallback. */
export function dragCd(profile: string): number { return DRAG_CD[profile] ?? DRAG_CD.cube; }
/** Transonic drag-rise factor on a base Cd (approx, wind-tunnel-curve fit).
 * Subsonic ≈1, Mach 1 bump ≈1.9×, supersonic plateau ≈1.25×. Constant-Cd
 * ballistics under-read the wall near Mach 1 by almost half — this closes it. */
export function machCdFactor(vMs: number, tempC = 15): number {
  const c = 331.3 * Math.sqrt(Math.max(1, tempC + 273.15) / 273.15);
  const M = Math.max(0, vMs) / c;
  if (M < 0.8) return 1;
  if (M <= 1.2) {
    const x = (M - 0.8) / 0.4; // 0→1 across the bump
    return 1 + 0.9 * Math.sin(Math.PI * Math.min(1, x * 1.15));
  }
  return 1.25;
}
/** Magnus lift coefficient from spin parameter S = ωR/v (approx baseball-curve
 * fit, spheres; boxes tumble instead of lifting — caller gates by shape). */
export function magnusCl(spinRadS: number, radiusM: number, vMs: number): number {
  if (vMs < 1e-6) return 0;
  const S = (Math.abs(spinRadS) * Math.max(0, radiusM)) / vMs;
  return Math.min(0.5, 0.12 * S);
}
/** Biot number Bi = h·Lc/k: ≤0.1 means uniform body temperature is honest;
 * above it the core lags the skin and lumped-capacitance times are bounds. */
export function biotNumber(hWm2K: number, charLenM: number, kWmK: number): number {
  if (kWmK <= 0 || charLenM <= 0) return NaN;
  return (hWm2K * charLenM) / kWmK;
}
/** Stokes-regime drag force in a viscous fluid (low Reynolds spheres). */
export function viscousDrag(viscosityPas: number, radiusM: number, vMs: number): number {
  return 6 * Math.PI * viscosityPas * radiusM * vMs;
}
// ---- Data-set-1 verdicts (science.ts codex II) ----
/** Electrical: conductors (σ ≥ 1e3 S/m) carry current; insulators hold to breakdown. */
export function electroVerdict(conductivity: number, breakdownMVm: number, matName: string): string {
  if (conductivity >= 1e3) return `${matName} (σ=${conductivity.toExponential(1)} S/m) conducts — current flows, sparks at contact. REAL.`;
  return `${matName} (σ=${conductivity.toExponential(1)} S/m) insulates to ${breakdownMVm} MV/m — holds household voltage. REAL.`;
}
/** Corrosion: minutes to destroy 10 mm; >= 99999 = immune. */
export function corrosionVerdict(minutes: number, acidName: string, matName: string): string {
  if (minutes >= 99999) return `${matName} is immune to ${acidName} — passivation holds indefinitely. REAL.`;
  if (minutes < 1) return `${acidName} destroys ${matName} in under a minute — near-instant. REAL.`;
  if (minutes < 60) return `${acidName} eats through ${matName} in ~${minutes} min — violent, visible bubbling. REAL.`;
  if (minutes < 1440) return `${acidName} defeats ${matName} in ~${(minutes / 60).toFixed(1)} h — slow etching. REAL.`;
  return `${acidName} vs ${matName}: ~${(minutes / 1440).toFixed(1)} days — effectively safe short-term. REAL.`;
}
/** Snell refraction air → medium at 45° incidence. Returns bend angle in medium. */
export function snellBend(n: number): { bendDeg: number; note: string } {
  const s = Math.sin(Math.PI / 4) / n;
  if (s >= 1) return { bendDeg: NaN, note: "total internal reflection — beam trapped" };
  const bendDeg = (Math.asin(s) * 180) / Math.PI;
  return { bendDeg, note: `45° in air → ${bendDeg.toFixed(1)}° inside (n=${n})` };
}
/** Rolling stop distance from speed v with coefficient c_rr on flat ground. */
export function rollingStop(vMs: number, crr: number, g = PHYSICS.G_EARTH): number {
  return (vMs * vMs) / (2 * g * Math.max(1e-6, crr));
}
/** Radiation dose at distance (inverse square, 1 kg reference mass). */
export function doseAt(baseUSvH: number, massKg: number, distM: number): number {
  return (baseUSvH * massKg) / Math.max(0.25, distM * distM);
}
/** Gas toxicity tier at ppm. */
export function toxicityTier(ppm: number, t: { warnPpm: number; minorPpm: number; severePpm: number; lethalPpm: number }, gasName: string): string {
  if (ppm >= t.lethalPpm) return `${ppm} ppm ${gasName} is instantly lethal — unconscious in seconds. NOT survivable.`;
  if (ppm >= t.severePpm) return `${ppm} ppm ${gasName}: severe — blackout/health drain within minutes. NOT REAL to ignore.`;
  if (ppm >= t.minorPpm) return `${ppm} ppm ${gasName}: symptoms (blur, cough, shake) but survivable briefly. REAL.`;
  if (ppm >= t.warnPpm && t.warnPpm > 0) return `${ppm} ppm ${gasName}: warning smell only. REAL and safe.`;
  return `${ppm} ppm ${gasName}: below effect threshold. REAL, no symptoms.`;
}
/** Sensible heat: energy (J) to move mass through ΔT. Q = m·c·ΔT. */
export function heatEnergyJ(massKg: number, specificHeat: number, deltaTK: number): number {
  return massKg * specificHeat * deltaTK;
}
/** Total energy (kJ) to bring 1 kg from ambient to liquid: sensible + latent fusion. */
export function meltEnergyKJ(specificHeat: number, meltC: number, ambientC: number, fusionKJkg = 0): number {
  return (specificHeat * Math.max(0, meltC - ambientC)) / 1000 + Math.max(0, fusionKJkg);
}
/** Lumped-capacitance heating time (s): mass m, area A, convection h, bath Tinf.
 *  t = (m·c/(h·A))·ln((Tinf−T0)/(Tinf−T1)). Requires T1 < Tinf. */
export function heatTimeS(massKg: number, specificHeat: number, areaM2: number, h: number, tInfC: number, t0C: number, t1C: number): number {
  if (t1C >= tInfC || h <= 0 || areaM2 <= 0) return NaN;
  return ((massKg * specificHeat) / (h * areaM2)) * Math.log((tInfC - t0C) / (tInfC - t1C));
}
/** Lorentz factor at velocity v (m/s). */
export function lorentz(vMs: number, c = PHYSICS.C): number {
  const b = Math.min(0.999999999, vMs / c);
  return 1 / Math.sqrt(1 - b * b);
}
/** Relativistic kinetic energy (J): (γ−1)·m·c². */
export function relKineticJ(massKg: number, vMs: number, c = PHYSICS.C): number {
  return (lorentz(vMs, c) - 1) * massKg * c * c;
}
/** Circular orbit velocity (m/s) at altitude over a body with parameter mu. */
export function orbitVelocity(mu: number, radiusM: number, altitudeM: number): number {
  return Math.sqrt(mu / (radiusM + Math.max(0, altitudeM)));
}
/** Escape velocity (m/s) from a body surface. */
export function escapeVelocity(mu: number, radiusM: number): number {
  return Math.sqrt((2 * mu) / radiusM);
}
/** Orbital period (s) of a circular orbit. */
export function orbitPeriodS(mu: number, radiusM: number, altitudeM: number): number {
  const r = radiusM + Math.max(0, altitudeM);
  return 2 * Math.PI * Math.sqrt((r * r * r) / mu);
}
/** Distance to the horizon (m) from eye height h over radius R. */
export function horizonM(eyeM: number, radiusM = 6.371e6): number {
  return Math.sqrt(2 * radiusM * Math.max(0, eyeM));
}
/** Speed of sound in dry air (m/s) at temperature: c = 331.3·√(T/273.15). */
export function soundSpeed(tempC: number): number {
  return 331.3 * Math.sqrt(Math.max(1, tempC + 273.15) / 273.15);
}
/** Gravity at altitude h over a body of surface gravity g0 and radius R. */
export function gravityAt(g0: number, radiusM: number, altitudeM: number): number {
  const r = radiusM + Math.max(0, altitudeM);
  return g0 * (radiusM * radiusM) / (r * r);
}
/** Blackbody radiative flux (W/m²) at surface temperature: σT⁴. */
export function blackbodyFlux(tempC: number): number {
  const T = tempC + 273.15;
  return PHYSICS.STEFAN_BOLTZMANN * T * T * T * T;
}
/** Human fall survival odds (nearest-below bracket of trauma table). */
export function fallSurvival(heightM: number, odds: { heightM: number; odds: number; note: string }[]): string {
  let cur = odds[0];
  for (const o of odds) if (heightM >= o.heightM) cur = o;
  if (heightM > odds[odds.length - 1].heightM)
    return `Above ${odds[odds.length - 1].heightM} m — survival ≈ ${(odds[odds.length - 1].odds * 100).toFixed(0)}% or worse (${odds[odds.length - 1].note}). NOT REAL to walk away.`;
  return `From ${heightM} m: ~${(cur.odds * 100).toFixed(0)}% survive (${cur.note}). ${cur.odds >= 0.9 ? "REAL to survive." : cur.odds >= 0.5 ? "MIXED — coin flip." : "NOT REAL to walk away."}`;
}
