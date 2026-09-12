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
/** Stokes-regime drag force in a viscous fluid (low Reynolds spheres). */
export function viscousDrag(viscosityPas: number, radiusM: number, vMs: number): number {
  return 6 * Math.PI * viscosityPas * radiusM * vMs;
}
