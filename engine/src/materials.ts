// Real material database — distilled from codex tables 3,4,5,9,10,12,14,15,19,20,22.
// Every number below comes from those tables; `restitution` is the ONLY tuned value
// (marked as such) because bounce is a pair property, not a material constant.
export interface MaterialDef {
  id: string; name: string;
  density: number;            // kg/m³ (table 3)
  meltC?: number; ignitionC?: number;  // table 4
  tensileMpa?: number; yieldMpa?: number; ultimateMpa?: number; // tables 5, 20
  youngGpa?: number; poisson?: number; // table 14
  mohs?: number;              // table 10
  thermalWmK?: number;        // table 15
  soundMs?: number;           // table 6
  muS?: number; muK?: number; // table 12 (representative pair)
  color: number; restitution: number; // restitution ≈ gameplay-tuned, documented
}

export const MATERIALS: Record<string, MaterialDef> = {
  aerogel:   { id: "aerogel", name: "Aerogel", density: 1.0, yieldMpa: 0.02, ultimateMpa: 0.04, soundMs: 100, color: 0xdfe8ee, restitution: 0.1 },
  styrofoam: { id: "styrofoam", name: "Styrofoam", density: 75, yieldMpa: 0.2, ultimateMpa: 0.4, soundMs: 500, color: 0xf2f2f2, restitution: 0.3 },
  oak:       { id: "oak", name: "Oak Wood", density: 750, ignitionC: 300, tensileMpa: 40, yieldMpa: 35, ultimateMpa: 40, youngGpa: 11, poisson: 0.3, mohs: 2.5, soundMs: 3850, muS: 0.4, muK: 0.2, color: 0x7a5230, restitution: 0.4 },
  water:     { id: "water", name: "Water", density: 1000, thermalWmK: 0.6, soundMs: 1481, color: 0x1a3a55, restitution: 0 }, // liquid: melts N/A (ice melts), boils 100
  concrete:  { id: "concrete", name: "Concrete", density: 2400, tensileMpa: 3.5, yieldMpa: 15, ultimateMpa: 4, youngGpa: 30, poisson: 0.2, thermalWmK: 1.0, soundMs: 3200, color: 0x8a8a86, restitution: 0.1 },
  glass:     { id: "glass", name: "Window Glass", density: 2500, ultimateMpa: 70, thermalWmK: 1.7, mohs: 5.5, soundMs: 4540, color: 0xbfe0e8, restitution: 0.2 },
  aluminium: { id: "aluminium", name: "Aluminium", density: 2700, meltC: 660.3, yieldMpa: 276, ultimateMpa: 310, thermalWmK: 210, soundMs: 6420, color: 0xc0c4c8, restitution: 0.3 },
  iron:      { id: "iron", name: "Iron", density: 7874, meltC: 1538, yieldMpa: 50, ultimateMpa: 250, soundMs: 5960, color: 0x6b6f72, restitution: 0.3 },
  steel:     { id: "steel", name: "Structural Steel", density: 7850, meltC: 1450, tensileMpa: 400, yieldMpa: 250, ultimateMpa: 400, youngGpa: 200, poisson: 0.3, thermalWmK: 50, mohs: 5.5, soundMs: 5960, color: 0x7d848a, restitution: 0.35 },
  lead:      { id: "lead", name: "Lead", density: 11340, meltC: 327.5, yieldMpa: 10, ultimateMpa: 18, soundMs: 2160, color: 0x4a4d52, restitution: 0.15 },
  gold:      { id: "gold", name: "Gold", density: 19300, meltC: 1064, yieldMpa: 20, ultimateMpa: 120, soundMs: 3240, color: 0xd4af37, restitution: 0.2 },
  copper:    { id: "copper", name: "Copper", density: 8960, meltC: 1085, yieldMpa: 70, ultimateMpa: 220, thermalWmK: 401, soundMs: 4760, color: 0xb87333, restitution: 0.3 },
  bronze:    { id: "bronze", name: "Bronze", density: 8800, meltC: 913, yieldMpa: 150, ultimateMpa: 300, soundMs: 4700, color: 0xa67c3d, restitution: 0.3 },
  titanium:  { id: "titanium", name: "Titanium Alloy", density: 4500, meltC: 1668, tensileMpa: 900, yieldMpa: 880, ultimateMpa: 950, soundMs: 6070, color: 0x9aa2ab, restitution: 0.35 },
  diamond:   { id: "diamond", name: "Diamond", density: 3510, meltC: 4027, ultimateMpa: 2800, thermalWmK: 2200, mohs: 10, soundMs: 12000, color: 0xcfe8ff, restitution: 0.5 },
  rubber:    { id: "rubber", name: "Rubber", density: 1500, youngGpa: 0.05, poisson: 0.5, yieldMpa: 2, ultimateMpa: 20, soundMs: 60, muS: 1.0, muK: 0.8, color: 0x222222, restitution: 0.85 },
  teflon:    { id: "teflon", name: "Teflon", density: 2200, yieldMpa: 23, ultimateMpa: 48, muS: 0.04, muK: 0.04, soundMs: 1400, color: 0xe8e8e8, restitution: 0.2 },
  ice:       { id: "ice", name: "Water Ice", density: 917, meltC: 0, thermalWmK: 2.2, mohs: 2, muS: 0.1, muK: 0.03, soundMs: 3980, color: 0xcfe8f2, restitution: 0.3 },
  graphite:  { id: "graphite", name: "Carbon/Graphite", density: 2260, mohs: 1.5, soundMs: 3000, color: 0x333336, restitution: 0.2 },
  tungstenCarbide: { id: "tungstenCarbide", name: "Tungsten Carbide", density: 15600, youngGpa: 550, poisson: 0.2, mohs: 9, soundMs: 6220, color: 0x555558, restitution: 0.3 },
  carbonFibre: { id: "carbonFibre", name: "Carbon Fibre", density: 1750, tensileMpa: 3500, soundMs: 8000, color: 0x1a1a1e, restitution: 0.4 },
  bamboo:    { id: "bamboo", name: "Structural Bamboo", density: 600, yieldMpa: 40, ultimateMpa: 120, soundMs: 5000, color: 0x9aa04e, restitution: 0.4 },
  cork:      { id: "cork", name: "Cork", density: 240, youngGpa: 0.03, poisson: 0, soundMs: 500, color: 0xb08d57, restitution: 0.2 },
  soil:      { id: "soil", name: "Loose Soil", density: 1500, soundMs: 300, color: 0x5a4632, restitution: 0.05 },
  sand:      { id: "sand", name: "Dry Sand", density: 1600, soundMs: 300, color: 0xc2a878, restitution: 0.05 },
  brass:     { id: "brass", name: "Brass", density: 8500, meltC: 900, yieldMpa: 200, ultimateMpa: 350, thermalWmK: 110, mohs: 4, soundMs: 4700, color: 0xb5a642, restitution: 0.3 },
  silver:    { id: "silver", name: "Silver", density: 10490, meltC: 961.8, yieldMpa: 55, ultimateMpa: 140, thermalWmK: 429, mohs: 2.5, soundMs: 3650, color: 0xc0c0c0, restitution: 0.3 },
  nickel:    { id: "nickel", name: "Nickel", density: 8908, meltC: 1455, yieldMpa: 150, ultimateMpa: 400, thermalWmK: 91, mohs: 4, soundMs: 5630, color: 0x8a8d7a, restitution: 0.3 },
  zinc:      { id: "zinc", name: "Zinc", density: 7140, meltC: 419.5, yieldMpa: 75, ultimateMpa: 150, thermalWmK: 116, soundMs: 4210, color: 0x9aa0a6, restitution: 0.3 },
  platinum:  { id: "platinum", name: "Platinum", density: 21450, meltC: 1768, yieldMpa: 125, ultimateMpa: 200, thermalWmK: 72, mohs: 4.5, soundMs: 3260, color: 0xd0d0d8, restitution: 0.3 },
  marble:    { id: "marble", name: "Marble", density: 2700, ultimateMpa: 15, mohs: 3, thermalWmK: 2.5, soundMs: 3800, color: 0xe8e4da, restitution: 0.15 },
  granite:   { id: "granite", name: "Granite", density: 2750, ultimateMpa: 20, mohs: 6.5, thermalWmK: 2.8, soundMs: 6000, color: 0x7a6f68, restitution: 0.15 },
  coal:      { id: "coal", name: "Coal", density: 1300, ignitionC: 400, ultimateMpa: 20, soundMs: 2000, color: 0x1a1a1a, restitution: 0.1 },
  paper:     { id: "paper", name: "Paper", density: 900, ignitionC: 233, ultimateMpa: 30, soundMs: 1000, color: 0xf5f0e1, restitution: 0.2 },
  clay:      { id: "clay", name: "Clay", density: 1700, ultimateMpa: 5, mohs: 2, soundMs: 1500, color: 0x9c6644, restitution: 0.05 },
  silicon:   { id: "silicon", name: "Silicon", density: 2330, meltC: 1414, ultimateMpa: 170, youngGpa: 150, thermalWmK: 150, mohs: 7, soundMs: 8430, color: 0x6a6f75, restitution: 0.3 },
  quartz:    { id: "quartz", name: "Quartz", density: 2650, ultimateMpa: 100, thermalWmK: 8, mohs: 7, soundMs: 5800, color: 0xe8e2d4, restitution: 0.2 },
  salt:      { id: "salt", name: "Salt (Halite)", density: 2160, meltC: 801, ultimateMpa: 5, mohs: 2.5, soundMs: 4600, color: 0xf5f2ea, restitution: 0.2 },
  sugar:     { id: "sugar", name: "Sugar", density: 1590, meltC: 186, ultimateMpa: 10, mohs: 2, soundMs: 2000, color: 0xfaf6ee, restitution: 0.2 },
  chalk:     { id: "chalk", name: "Chalk", density: 2710, ultimateMpa: 10, mohs: 3, thermalWmK: 2, soundMs: 3800, color: 0xf2efe6, restitution: 0.15 },
};

export interface FluidDef { id: string; name: string; viscosity: number; density?: number; tempC?: number }
// Table 7. Density only where the codex or common reference is certain; otherwise
// viscosity-only drag applies and buoyancy verdicts report "unknown".
// tempC pins a fluid's temperature (lava erupts at 700–1200°C); fluids without
// one sit at ambient, so pools track weather and seasons.
export const FLUIDS: Record<string, FluidDef> = {
  air:      { id: "air", name: "Air", viscosity: 0.000018, density: 1.225 },
  water:    { id: "water", name: "Water", viscosity: 0.001, density: 1000 },
  seawater: { id: "seawater", name: "Sea Water", viscosity: 0.00108, density: 1025 },
  mercury:  { id: "mercury", name: "Mercury", viscosity: 0.00155, density: 13534 },
  oliveOil: { id: "oliveOil", name: "Olive Oil", viscosity: 0.081, density: 910 },
  motorOil: { id: "motorOil", name: "Motor Oil SAE30", viscosity: 0.29, density: 880 },
  ketchup:  { id: "ketchup", name: "Ketchup", viscosity: 50, density: 1140 },
  honey:    { id: "honey", name: "Honey", viscosity: 10.0, density: 1420 },
  lava:     { id: "lava", name: "Molten Lava", viscosity: 1000, density: 2600, tempC: 1000 }, // basaltic eruption mid-range, approx
  milk:     { id: "milk", name: "Milk", viscosity: 0.003, density: 1030 },
  blood:    { id: "blood", name: "Blood", viscosity: 0.004, density: 1060 },
  alcohol:  { id: "alcohol", name: "Ethanol", viscosity: 0.0012, density: 789 },
  diesel:   { id: "diesel", name: "Diesel Fuel", viscosity: 0.004, density: 850 },
};

// Table 13 — drag coefficients by profile.
export const DRAG_CD: Record<string, number> = {
  airfoil: 0.05, fighterJet: 0.02, sphere: 0.47, bullet: 0.3,
  cube: 1.05, plate: 1.28, parachute: 1.75,
};

// Table 10 — reference ladder for scratch verdicts.
export const MOHS_LADDER: [string, number][] = [
  ["talc", 1], ["gypsum", 2], ["calcite", 3], ["fluorite", 4], ["apatite", 5],
  ["feldspar", 6], ["quartz", 7], ["topaz", 8], ["corundum", 9], ["diamond", 10],
];

// Table 16 — detonation tiers (velocity → class → effect).
export function explosiveClass(detVelMs: number): string {
  if (detVelMs < 1000) return "Deflagration — pushes, low structural damage (black powder tier)";
  if (detVelMs < 5000) return "Low detonation — wide rolling blast, high smoke (ammonium-nitrate tier)";
  if (detVelMs < 8000) return "High detonation — balanced shockwave and fire (TNT tier)";
  return "Ultra-high detonation — vaporizes close objects (C-4/RDX/PETN tier)";
}
export const EXPLOSIVES: Record<string, number> = {
  blackPowder: 600, ammoniumNitrate: 2700, tnt: 6900, c4: 8090, petn: 8400, rdx: 8750,
};

// Table 12 — named friction pairs.
export const FRICTION_PAIRS: Record<string, { muS: number; muK: number }> = {
  rubberDryConcrete: { muS: 1.0, muK: 0.8 },
  rubberWetConcrete: { muS: 0.3, muK: 0.25 },
  steelOiled: { muS: 0.1, muK: 0.05 },
  iceOnIce: { muS: 0.1, muK: 0.03 },
  woodOnWood: { muS: 0.4, muK: 0.2 },
  teflon: { muS: 0.04, muK: 0.04 },
};

// Table 23 — angle of repose per granular state.
export const REPOSE_DEG: Record<string, [number, number]> = {
  volcanicAsh: [20, 25], drySand: [30, 35], dampSand: [45, 50],
  gravel: [40, 45], soil: [35, 40], scree: [35, 45],
};

// Tables 24–25, trimmed to what verdicts need.
export const STARS: Record<string, { tempK: string; color: string; hazardX: number }> = {
  O: { tempK: "30000–50000", color: "violet-blue", hazardX: 120 },
  B: { tempK: "10000–30000", color: "blue-white", hazardX: 25 },
  A: { tempK: "7500–10000", color: "white", hazardX: 5 },
  F: { tempK: "6000–7500", color: "yellow-white", hazardX: 1.8 },
  G: { tempK: "5200–6000", color: "yellow", hazardX: 1.0 },
  K: { tempK: "3700–5200", color: "orange", hazardX: 0.4 },
  M: { tempK: "2400–3700", color: "red-orange", hazardX: 0.1 },
};
export const GASES: Record<string, { r: number; density: number; note: string }> = {
  hydrogen: { r: 4124, density: 0.089, note: "pools on ceilings, extreme explosion risk" },
  helium: { r: 2077, density: 0.178, note: "vents upward out of shafts" },
  methane: { r: 518, density: 0.674, note: "rises, asphyxiation pockets in high rooms" },
  oxygen: { r: 260, density: 1.354, note: "accelerates all fire ticks" },
  co2: { r: 189, density: 1.874, note: "sinks into trenches, suffocates low players" },
  propane: { r: 189, density: 1.882, note: "flows downstairs like invisible fluid" },
};
