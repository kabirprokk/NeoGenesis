// Star formation — real gravitational-collapse science for the plane lab.
// The lab is NOT a planet (NEOGENESIS_RULES Law 2): these functions model how
// real stars form elsewhere, and the lab sky shows the real Earth sky. They do
// NOT change lab gravity — EngineWorld keeps plane-coupled g(h) = g0*(R/(R+h))²
// (world.ts). Timescales are compressed for verdicts, never real-time.
//
// Sources: Jeans (1902) instability, Spitzer star-formation notes, Carroll &
// Ostlie Ch.12, Kippenhahn stellar structure. Certainty labeled per value.
import { PHYSICS } from "./constants.js";

// Measured (CODATA 2018) — not in PHYSICS table yet, kept local + labeled.
export const K_B = 1.380649e-23; // J/K, measured
export const M_H = 1.673557546e-27; // kg, measured
export const M_SUN = 1.98847e30; // kg, measured (IAU 2015)
export const L_SUN_W = 3.828e26; // W, measured
// approx: mean molecular weight of a cold molecular cloud (H2 + He mix).
export const MU_CLOUD = 2.33; // approx, labeled

export type StarFate =
  | "brown-dwarf"
  | "red-dwarf"
  | "sun-like-white-dwarf"
  | "neutron-star"
  | "black-hole";

/** Gas density from number density: rho = n * mu * m_H. n in cm⁻³. */
export function cloudDensityKgM3(nPerCm3: number): number {
  return Math.max(0, nPerCm3) * 1e6 * MU_CLOUD * M_H;
}

/** Isothermal sound speed in the cloud: c_s = sqrt(kT / mu m_H). */
export function soundSpeedCloud(T_K: number): number {
  return Math.sqrt((K_B * Math.max(0.1, T_K)) / (MU_CLOUD * M_H));
}

/** Jeans length (m): λ_J = sqrt(pi * c_s² / G rho). */
export function jeansLengthM(T_K: number, nPerCm3: number): number {
  const rho = cloudDensityKgM3(nPerCm3);
  if (rho <= 0) return NaN;
  const cs = soundSpeedCloud(T_K);
  return Math.sqrt((Math.PI * cs * cs) / (PHYSICS.G * rho));
}

/** Jeans mass (solar masses): M_J = (pi^2.5/6) * c_s³ / (G^1.5 sqrt(rho)). */
export function jeansMassMsun(T_K: number, nPerCm3: number): number {
  const rho = cloudDensityKgM3(nPerCm3);
  if (rho <= 0) return NaN;
  const cs = soundSpeedCloud(T_K);
  const m = ((Math.PI ** 2.5) / 6) * (cs ** 3) / (Math.pow(PHYSICS.G, 1.5) * Math.sqrt(rho));
  return m / M_SUN;
}

/** Free-fall time (s): t_ff = sqrt(3 pi / 32 G rho). Measured-formula. */
export function freeFallTimeS(nPerCm3: number): number {
  const rho = cloudDensityKgM3(nPerCm3);
  if (rho <= 0) return NaN;
  return Math.sqrt((3 * Math.PI) / (32 * PHYSICS.G * rho));
}

/** Collapse verdict: REAL when cloud mass exceeds Jeans mass. */
export function collapseVerdict(massMsun: number, T_K: number, nPerCm3: number): string {
  const mj = jeansMassMsun(T_K, nPerCm3);
  if (!Number.isFinite(mj)) return `No collapse verdict — density ${nPerCm3} cm⁻³ is not physical. MIXED (gap: valid n).`;
  if (massMsun > mj)
    return `${massMsun} Msun > Jeans ${mj.toFixed(1)} Msun (T=${T_K}K, n=${nPerCm3}cm⁻³) — gravity wins, cloud collapses. REAL.`;
  return `${massMsun} Msun <= Jeans ${mj.toFixed(1)} Msun — pressure holds, no collapse. REAL (stable).`;
}

/** Protostar stage by core temperature (approx thresholds, labeled). */
export function protostarStage(coreTempK: number): string {
  if (coreTempK < 2000) return "collapse: molecular core contracting, no fusion";
  if (coreTempK < 1e6) return "protostar: Kelvin-Helmholtz contraction, deuterium burning";
  if (coreTempK < 4e6) return "T-Tauri: hydrogen not yet fusing, strong winds";
  return "main-sequence: core H fusion (pp-chain/CNO), hydrostatic equilibrium";
}

/** Final fate by initial mass (approx boundaries; Chandrasekhar 1.44 + TOV ~2.16). */
export function starFate(massMsun: number): { fate: StarFate; remnant: string } {
  if (massMsun < 0.08) return { fate: "brown-dwarf", remnant: "Brown dwarf — never fuses H, cools as failed star. REAL." };
  if (massMsun < 0.5) return { fate: "red-dwarf", remnant: "Red dwarf — fuses H for trillions of years, ends as He white dwarf. REAL." };
  if (massMsun <= 8) return { fate: "sun-like-white-dwarf", remnant: "Sun-like — red giant → carbon-oxygen white dwarf (<1.44 Msun Chandrasekhar). REAL." };
  if (massMsun <= 25) return { fate: "neutron-star", remnant: "Massive — supernova → neutron star (<~2.16 Msun TOV, approx). REAL." };
  return { fate: "black-hole", remnant: "Very massive — supernova → black hole. REAL." };
}

/** Main-sequence luminosity L/Lsun ≈ (M/Msun)^3.5 (approx mass-luminosity, labeled). */
export function starLuminosityLsun(massMsun: number): number {
  return Math.pow(Math.max(1e-3, massMsun), 3.5);
}

/** Main-sequence lifetime (yr): t ≈ 1e10 * (M/L). Sun ≈ 1e10 yr check. */
export function starLifetimeYr(massMsun: number): number {
  const l = starLuminosityLsun(massMsun);
  return 1e10 * (massMsun / l);
}

/** Habitable zone (AU) from luminosity: [0.95, 1.37] * sqrt(L) (Kasting approx). */
export function habitableZoneAU(luminosityLsun: number): [number, number] {
  const s = Math.sqrt(Math.max(0, luminosityLsun));
  return [0.95 * s, 1.37 * s];
}

/** Full scientific verdict for one cloud → star story. Gravity note included. */
export function starFormVerdict(massMsun: number, T_K: number, nPerCm3: number): {
  jeansMsun: number; freeFallMyr: number; collapse: string; stage: string;
  fate: string; lifetimeYr: number; hzAU: [number, number]; gravityNote: string;
} {
  const jeansMsun = jeansMassMsun(T_K, nPerCm3);
  const freeFallMyr = freeFallTimeS(nPerCm3) / (365.25 * 24 * 3600 * 1e6);
  const fate = starFate(massMsun).remnant;
  const lifetimeYr = starLifetimeYr(massMsun);
  const hzAU = habitableZoneAU(starLuminosityLsun(massMsun));
  const collapsing = massMsun > jeansMsun;
  return {
    jeansMsun: +jeansMsun.toFixed(2),
    freeFallMyr: +freeFallMyr.toFixed(3),
    collapse: collapseVerdict(massMsun, T_K, nPerCm3),
    stage: collapsing ? "collapse: molecular core contracting, no fusion" : "stable cloud: no protostar stage",
    fate,
    lifetimeYr,
    hzAU: [+hzAU[0].toFixed(2), +hzAU[1].toFixed(2)],
    gravityNote: "Lab gravity unchanged: EngineWorld keeps plane-coupled g(h)=g0*(R/(R+h))². Star gravity acts in its own system, watched by the same G.",
  };
}
