// Science codex II — transcribed from engine/data/data-set-1.txt (raw source kept).
// Each entry keeps its Source + Certainty so Neo labels tuned values in-source,
// same honesty rule as materials.ts (`restitution`).
// Covers: electrical, corrosion, altitude air, optics, rolling, surface tension,
// thermal expansion, acoustic damping, isotopes, gas toxicity, human limits.

export type Certainty = "measured" | "approx" | "gameplay-tuned";
export interface Sourced { source: string; certainty: Certainty }

// ------------------------------------------------------- 1. electrical
export interface ElectricalDef extends Sourced {
  id: string; name: string;
  conductivity: number; // S/m at 20°C
  resistivity: number; // Ω·m
  breakdownMVm: number; // MV/m; 0 = conductor (arcs at any voltage)
}
export const ELECTRICAL: Record<string, ElectricalDef> = {
  silver:      { id: "silver", name: "Silver", conductivity: 6.30e7, resistivity: 1.59e-8, breakdownMVm: 0, source: "CRC Handbook", certainty: "measured" },
  copper:      { id: "copper", name: "Copper", conductivity: 5.96e7, resistivity: 1.68e-8, breakdownMVm: 0, source: "NIST Reference Data", certainty: "measured" },
  aluminium:   { id: "aluminium", name: "Aluminium", conductivity: 3.50e7, resistivity: 2.82e-8, breakdownMVm: 0, source: "CRC Handbook", certainty: "measured" },
  steel:       { id: "steel", name: "Structural Steel", conductivity: 6.90e6, resistivity: 1.45e-7, breakdownMVm: 0, source: "ASM International", certainty: "approx" },
  titanium:    { id: "titanium", name: "Titanium Alloy", conductivity: 5.56e5, resistivity: 1.80e-6, breakdownMVm: 0, source: "Titanium Metals Corp", certainty: "measured" },
  graphite:    { id: "graphite", name: "Carbon/Graphite", conductivity: 3.00e4, resistivity: 3.33e-5, breakdownMVm: 0, source: "Carbon Elements Properties", certainty: "approx" },
  seawater:    { id: "seawater", name: "Sea Water", conductivity: 4.80, resistivity: 2.08e-1, breakdownMVm: 0.15, source: "NOAA Oceanographic Data", certainty: "measured" },
  pureWater:   { id: "pureWater", name: "Deionised Water", conductivity: 5.50e-6, resistivity: 1.82e5, breakdownMVm: 65, source: "ASTM D1125", certainty: "measured" },
  mineralOil:  { id: "mineralOil", name: "Transformer Mineral Oil", conductivity: 1.00e-12, resistivity: 1.00e12, breakdownMVm: 12, source: "IEC 60296", certainty: "measured" },
  air:         { id: "air", name: "Dry Ambient Air", conductivity: 5.00e-15, resistivity: 2.00e14, breakdownMVm: 3, source: "NASA Atmospheric Science", certainty: "approx" },
  rubber:      { id: "rubber", name: "Natural Vulcanized Rubber", conductivity: 1.00e-13, resistivity: 1.00e13, breakdownMVm: 25, source: "Rubber Manufacturers Assn", certainty: "approx" },
  porcelain:   { id: "porcelain", name: "Electrical Porcelain", conductivity: 1.00e-12, resistivity: 1.00e12, breakdownMVm: 30, source: "Ceramic Engineering Handbooks", certainty: "approx" },
  quartzGlass: { id: "quartzGlass", name: "Fused Quartz Glass", conductivity: 1.33e-18, resistivity: 7.50e17, breakdownMVm: 40, source: "Heraeus Quartz Data", certainty: "measured" },
  teflon:      { id: "teflon", name: "Teflon", conductivity: 1.00e-15, resistivity: 1.00e15, breakdownMVm: 60, source: "DuPont Material Properties", certainty: "measured" },
};

// ------------------------------------------------------- 2. corrosion
export interface AcidDef extends Sourced { id: string; name: string; ph: number }
export const ACIDS: Record<string, AcidDef> = {
  batteryAcid:  { id: "batteryAcid", name: "Battery Acid", ph: 0, source: "CRC Handbook", certainty: "measured" },
  gastricAcid:  { id: "gastricAcid", name: "Gastric Acid", ph: 1.5, source: "Guyton & Hall Physiology", certainty: "measured" },
  drainCleaner: { id: "drainCleaner", name: "Liquid Drain Cleaner", ph: 14, source: "Industrial SDS", certainty: "measured" },
  bleach:       { id: "bleach", name: "Bleach", ph: 13, source: "Clorox Spec Sheets", certainty: "measured" },
  pureWater:    { id: "pureWater", name: "Pure Water", ph: 7, source: "IUPAC Baseline", certainty: "measured" },
};
/** Minutes to destroy a 10 mm layer. >= 99999 = immune. */
export const IMMUNE_MIN = 99999;
export const CORROSION_MIN: Record<string, Record<string, number>> = {
  batteryAcid:  { steel: 12, aluminium: 45, titanium: IMMUNE_MIN, glass: IMMUNE_MIN, tissue: 1.5 },
  gastricAcid:  { steel: 180, aluminium: 240, titanium: IMMUNE_MIN, glass: IMMUNE_MIN, tissue: 15 },
  drainCleaner: { steel: IMMUNE_MIN, aluminium: 8, titanium: 1440, glass: 10080, tissue: 0.5 },
  bleach:       { steel: 1440, aluminium: 120, titanium: IMMUNE_MIN, glass: IMMUNE_MIN, tissue: 10 },
  pureWater:    { steel: 525600, aluminium: IMMUNE_MIN, titanium: IMMUNE_MIN, glass: IMMUNE_MIN, tissue: IMMUNE_MIN },
};

// ------------------------------------------------------- 3. altitude air
export interface AltitudeBand extends Sourced { altitudeM: number; density: number }
const ISA = "International Standard Atmosphere (ISA)";
export const ALTITUDE: AltitudeBand[] = [
  { altitudeM: 0, density: 1.2250, source: ISA, certainty: "measured" },
  { altitudeM: 1000, density: 1.1117, source: ISA, certainty: "measured" },
  { altitudeM: 2000, density: 1.0066, source: ISA, certainty: "measured" },
  { altitudeM: 3000, density: 0.9093, source: ISA, certainty: "measured" },
  { altitudeM: 4000, density: 0.8194, source: ISA, certainty: "measured" },
  { altitudeM: 5000, density: 0.7364, source: ISA, certainty: "measured" },
  { altitudeM: 6000, density: 0.6601, source: ISA, certainty: "measured" },
  { altitudeM: 7000, density: 0.5900, source: ISA, certainty: "measured" },
  { altitudeM: 8000, density: 0.5258, source: ISA, certainty: "measured" },
  { altitudeM: 9000, density: 0.4671, source: ISA, certainty: "measured" },
  { altitudeM: 10000, density: 0.4135, source: ISA, certainty: "measured" },
  { altitudeM: 11000, density: 0.3648, source: ISA, certainty: "measured" },
  { altitudeM: 12000, density: 0.3119, source: ISA, certainty: "measured" },
];
/** ISA air density at any altitude 0–12 km (linear between measured bands). */
export function altitudeDensity(altitudeM: number): number {
  const a = Math.min(12000, Math.max(0, altitudeM));
  for (let i = 1; i < ALTITUDE.length; i++) {
    if (a <= ALTITUDE[i].altitudeM) {
      const lo = ALTITUDE[i - 1], hi = ALTITUDE[i];
      const t = (a - lo.altitudeM) / (hi.altitudeM - lo.altitudeM);
      return lo.density + (hi.density - lo.density) * t;
    }
  }
  return ALTITUDE[ALTITUDE.length - 1].density;
}

// ------------------------------------------------------- 4. optics
export interface OpticDef extends Sourced { id: string; name: string; n: number; epsilon: number }
export const OPTICS: Record<string, OpticDef> = {
  vacuum:   { id: "vacuum", name: "Vacuum", n: 1.0, epsilon: 1.0, source: "NIST Reference Data", certainty: "measured" },
  air:      { id: "air", name: "Dry Air", n: 1.0003, epsilon: 1.0006, source: "CRC Handbook", certainty: "measured" },
  ice:      { id: "ice", name: "Water Ice", n: 1.31, epsilon: 3.2, source: "Earth Sciences Optical DB", certainty: "measured" },
  water:    { id: "water", name: "Pure Water", n: 1.333, epsilon: 80, source: "NIST Reference Data", certainty: "measured" },
  glass:    { id: "glass", name: "Window Glass", n: 1.52, epsilon: 5.0, source: "Schott Optical Catalog", certainty: "measured" },
  flint:    { id: "flint", name: "Flint Glass", n: 1.66, epsilon: 7.0, source: "Schott Optical Catalog", certainty: "measured" },
  sapphire: { id: "sapphire", name: "Synthetic Sapphire", n: 1.77, epsilon: 10.0, source: "Rubicon Crystals", certainty: "measured" },
  diamond:  { id: "diamond", name: "Natural Diamond", n: 2.417, epsilon: 5.7, source: "Gemological Institute of America", certainty: "measured" },
};

// ------------------------------------------------------- 5. rolling
export interface RollingDef extends Sourced { id: string; name: string; crr: number }
export const ROLLING: Record<string, RollingDef> = {
  railSteel:      { id: "railSteel", name: "Steel Wheel on Steel Rail", crr: 0.001, source: "Kent's Mechanical Handbook", certainty: "measured" },
  tyreAsphalt:    { id: "tyreAsphalt", name: "Car Tyre on Dry Asphalt", crr: 0.010, source: "SAE", certainty: "measured" },
  tyreConcrete:   { id: "tyreConcrete", name: "Car Tyre on Dry Concrete", crr: 0.015, source: "Bosch Automotive Handbook", certainty: "measured" },
  tyreWet:        { id: "tyreWet", name: "Car Tyre on Wet Asphalt", crr: 0.016, source: "Tire Science and Technology", certainty: "approx" },
  tyreGravel:     { id: "tyreGravel", name: "Car Tyre on Loose Gravel", crr: 0.025, source: "dynamic-traction-models", certainty: "approx" },
  tyreSand:       { id: "tyreSand", name: "Car Tyre on Sand", crr: 0.150, source: "US Army Corps of Engineers", certainty: "measured" },
  tyreIce:        { id: "tyreIce", name: "Car Tyre on Solid Ice", crr: 0.0015, source: "Friction and Lubrication Studies", certainty: "approx" },
  tyreSnow:       { id: "tyreSnow", name: "Car Tyre on Loose Snow", crr: 0.040, source: "Cold Regions Science", certainty: "approx" },
  truckMud:       { id: "truckMud", name: "Heavy Truck Tyre on Mud", crr: 0.200, source: "Journal of Terramechanics", certainty: "measured" },
  tracksGround:   { id: "tracksGround", name: "Crawler Tracks on Hard Ground", crr: 0.050, source: "Inst. of Mechanical Engineers", certainty: "approx" },
  tractorClay:    { id: "tractorClay", name: "Tractor Tyre on Soft Clay", crr: 0.220, source: "Journal of Terramechanics", certainty: "measured" },
};

// ------------------------------------------------------- 6. surface tension
export interface TensionDef extends Sourced {
  id: string; name: string; tensionMNm: number;
  wetting: "Zero" | "Low" | "Medium" | "High";
}
export const TENSION: Record<string, TensionDef> = {
  crudeOil:  { id: "crudeOil", name: "Crude Petroleum Oil", tensionMNm: 30.0, wetting: "High", source: "fluid-mechanics-data", certainty: "measured" },
  soapy:     { id: "soapy", name: "Soapy Water", tensionMNm: 25.0, wetting: "High", source: "CRC Handbook", certainty: "measured" },
  water:     { id: "water", name: "Pure Fresh Water", tensionMNm: 72.8, wetting: "Medium", source: "NIST Reference Data", certainty: "measured" },
  seawater:  { id: "seawater", name: "Sea Water", tensionMNm: 74.0, wetting: "Medium", source: "UNESCO Oceanographic Tables", certainty: "measured" },
  mercury:   { id: "mercury", name: "Liquid Mercury", tensionMNm: 486.5, wetting: "Zero", source: "CRC Handbook", certainty: "measured" },
  volcGlass: { id: "volcGlass", name: "Molten Volcanic Glass", tensionMNm: 350.0, wetting: "Low", source: "J. Geophysical Research", certainty: "approx" },
  fuelOil:   { id: "fuelOil", name: "Heavy Fuel Oil", tensionMNm: 35.0, wetting: "High", source: "Marine Engineering Standards", certainty: "measured" },
  lava:      { id: "lava", name: "Molten Lava", tensionMNm: 400.0, wetting: "Low", source: "Magma Thermodynamics Quarterly", certainty: "approx" },
};

// ------------------------------------------------------- 7. thermal expansion (10⁻⁶/K)
export const EXPANSION: Record<string, { value: number } & Sourced> = {
  quartzGlass: { value: 0.59, source: "Heraeus Quartz Data", certainty: "measured" },
  diamond:     { value: 1.00, source: "Properties of Diamond DB", certainty: "measured" },
  pyrex:       { value: 3.20, source: "Corning Specs", certainty: "measured" },
  glass:       { value: 9.00, source: "Schott Glass Catalog", certainty: "measured" },
  oakGrain:    { value: 5.00, source: "USDA Wood Handbook", certainty: "approx" },
  oakAcross:   { value: 30.00, source: "USDA Wood Handbook", certainty: "measured" },
  iron:        { value: 11.80, source: "CRC Handbook", certainty: "measured" },
  steel:       { value: 12.00, source: "AISC Steel Manual", certainty: "measured" },
  copper:      { value: 16.50, source: "NIST Reference Data", certainty: "measured" },
  aluminium:   { value: 23.10, source: "ASM International", certainty: "measured" },
  lead:        { value: 28.90, source: "CRC Handbook", certainty: "measured" },
  zinc:        { value: 30.20, source: "Metal Properties Handbook", certainty: "measured" },
  ice:         { value: 51.00, source: "High-Voltage Glaciology Data", certainty: "measured" },
  rubber:      { value: 80.00, source: "Rubber Manufacturers Assn", certainty: "approx" },
  teflon:      { value: 120.00, source: "DuPont Material Properties", certainty: "measured" },
};

// ------------------------------------------------------- 8. acoustic damping (dB/m at 1 kHz)
export const ACOUSTIC: Record<string, { value: number } & Sourced> = {
  aerogel:    { value: 120.0, source: "NASA JPL", certainty: "measured" },
  styrofoam:  { value: 45.0, source: "Acoustical Materials Handbook", certainty: "approx" },
  oak:        { value: 8.5, source: "USDA Wood Handbook", certainty: "measured" },
  water:      { value: 0.06, source: "NPL Ocean Acoustics", certainty: "measured" },
  concrete:   { value: 12.0, source: "ACI Acoustic Standards", certainty: "measured" },
  glass:      { value: 4.0, source: "Pilkington Glass Data", certainty: "measured" },
  aluminium:  { value: 0.15, source: "ASM International", certainty: "approx" },
  iron:       { value: 0.22, source: "Metal Properties Handbook", certainty: "approx" },
  lead:       { value: 35.0, source: "Lead Development Assn", certainty: "measured" },
  gold:       { value: 0.35, source: "Jewelry & Metal Physics", certainty: "approx" },
  bronze:     { value: 0.18, source: "Historical Metallurgy DB", certainty: "approx" },
  copper:     { value: 0.25, source: "NIST Reference Data", certainty: "measured" },
  steel:      { value: 0.20, source: "AISC Steel Manual", certainty: "measured" },
  titanium:   { value: 0.30, source: "Titanium Metals Corp", certainty: "measured" },
  diamond:    { value: 0.01, source: "Properties of Diamond DB", certainty: "measured" },
  carbonFibre:{ value: 6.5, source: "Composite Materials Handbook", certainty: "approx" },
  rubber:     { value: 55.0, source: "Rubber Manufacturers Assn", certainty: "measured" },
  porcelain:  { value: 8.0, source: "Ceramic Engineering Handbooks", certainty: "approx" },
  quartzGlass:{ value: 0.50, source: "Heraeus Quartz Data", certainty: "measured" },
  teflon:     { value: 22.0, source: "DuPont Material Properties", certainty: "measured" },
  bismuth:    { value: 1.8, source: "Rare Earth Metallurgy", certainty: "approx" },
  mineralOil: { value: 0.85, source: "IEC 60296", certainty: "measured" },
  air:        { value: 0.005, source: "ISO 9613-1 Acoustics", certainty: "measured" },
};

// ------------------------------------------------------- 9. isotopes (dose μSv/h at 1 m per 1 kg)
export interface IsotopeDef extends Sourced { id: string; name: string; halfLifeS: number; doseUSvH: number }
export const ISOTOPES: Record<string, IsotopeDef> = {
  radon222:  { id: "radon222", name: "Radon-222", halfLifeS: 330048, doseUSvH: 12500, source: "NIST Nuclear Data / EPA", certainty: "approx" },
  cobalt60:  { id: "cobalt60", name: "Cobalt-60", halfLifeS: 166224960, doseUSvH: 132000, source: "IAEA Nuclear Data / CDC", certainty: "measured" },
  tritium:   { id: "tritium", name: "Tritium (H-3)", halfLifeS: 388523520, doseUSvH: 0.05, source: "NIST Nuclear Data", certainty: "measured" },
  plutonium238: { id: "plutonium238", name: "Plutonium-238", halfLifeS: 2765793600, doseUSvH: 540, source: "DOE Isotope Program / NASA", certainty: "measured" },
  carbon14:  { id: "carbon14", name: "Carbon-14", halfLifeS: 180709920000, doseUSvH: 0.01, source: "Intl Radiocarbon DB", certainty: "measured" },
  plutonium239: { id: "plutonium239", name: "Plutonium-239", halfLifeS: 760893360000, doseUSvH: 22, source: "LLNL / DOE Safety", certainty: "measured" },
  uranium235:{ id: "uranium235", name: "Uranium-235", halfLifeS: 2.2215648e16, doseUSvH: 1.90, source: "Los Alamos / WNA", certainty: "measured" },
  uranium238:{ id: "uranium238", name: "Uranium-238", halfLifeS: 1.40915648e17, doseUSvH: 0.25, source: "Los Alamos / WNA", certainty: "measured" },
};

// ------------------------------------------------------- 10. gas toxicity (ppm thresholds)
export interface GasToxDef extends Sourced {
  id: string; name: string;
  warnPpm: number; minorPpm: number; severePpm: number; lethalPpm: number;
}
export const GASTOX: Record<string, GasToxDef> = {
  co:      { id: "co", name: "Carbon Monoxide", warnPpm: 0, minorPpm: 50, severePpm: 400, lethalPpm: 12800, source: "OSHA / CDC NIOSH", certainty: "measured" },
  h2s:     { id: "h2s", name: "Hydrogen Sulfide", warnPpm: 0.01, minorPpm: 10, severePpm: 100, lethalPpm: 800, source: "ACGIH / OSHA / CDC", certainty: "measured" },
  mercury: { id: "mercury", name: "Mercury Vapor", warnPpm: 0, minorPpm: 0.01, severePpm: 1, lethalPpm: 50, source: "WHO / EPA / CDC", certainty: "measured" },
};

// ------------------------------------------------------- 11. human limits
export const HUMAN: Record<string, { value: number; unit: string } & Sourced> = {
  gripN:        { value: 1200, unit: "N", source: "J. Biomechanics", certainty: "measured" },
  sprintMs:     { value: 12.4, unit: "m/s", source: "IAAF Biomechanics", certainty: "measured" },
  deadliftKg:   { value: 500, unit: "kg", source: "World Powerlifting Federation", certainty: "measured" },
  carryKg:      { value: 45, unit: "kg", source: "US Army Field Manual", certainty: "gameplay-tuned" },
  hypoC:        { value: 35, unit: "°C core", source: "Wilderness Medical Society", certainty: "measured" },
  heatC:        { value: 40, unit: "°C core", source: "Wilderness Medical Society", certainty: "measured" },
  coldSurvS:    { value: 600, unit: "s at -40°C", source: "Arctic Military Survival Manual", certainty: "approx" },
  heatSurvS:    { value: 1200, unit: "s at 60°C", source: "NASA Bio-astronautics", certainty: "approx" },
};
/** Fall survival odds by height (measured/gameplay-tuned trauma statistics). */
export const FALL_ODDS: { heightM: number; odds: number; note: string }[] = [
  { heightM: 3, odds: 0.99, note: "minor leg damage if landing flat" },
  { heightM: 6, odds: 0.90, note: "major bone fractures forced" },
  { heightM: 12, odds: 0.50, note: "LD50 boundary" },
  { heightM: 25, odds: 0.01, note: "near-absolute lethal threshold" },
];
