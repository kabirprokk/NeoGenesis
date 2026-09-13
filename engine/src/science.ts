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
/** Air density at any altitude 0–86 km: measured ISA bands to 12 km, US-1976 above. */
export function altitudeDensity(altitudeM: number): number {
  const a = Math.min(86000, Math.max(0, altitudeM));
  if (a > 12000) return us76Atmo(a).rho;
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
// ------------------------------------------------------- 12. specific heat + fusion
// Specific heat capacity c (J/kg·K) and latent heat of fusion Lf (kJ/kg).
// Sensible heat Q = m·c·ΔT; melting one kg from ambient costs m·c·(meltC − Tamb) + m·Lf.
export interface ThermalDef extends Sourced { id: string; name: string; c: number; lf?: number }
export const SPECIFIC_HEAT: Record<string, ThermalDef> = {
  aluminium:  { id: "aluminium", name: "Aluminium", c: 900, lf: 397, source: "NIST Reference Data", certainty: "measured" },
  copper:     { id: "copper", name: "Copper", c: 385, lf: 205, source: "NIST Reference Data", certainty: "measured" },
  iron:       { id: "iron", name: "Iron", c: 449, lf: 247, source: "CRC Handbook", certainty: "measured" },
  steel:      { id: "steel", name: "Structural Steel", c: 490, lf: 270, source: "ASM International", certainty: "approx" },
  lead:       { id: "lead", name: "Lead", c: 129, lf: 23, source: "CRC Handbook", certainty: "measured" },
  gold:       { id: "gold", name: "Gold", c: 129, lf: 64, source: "NIST Reference Data", certainty: "measured" },
  silver:     { id: "silver", name: "Silver", c: 235, lf: 105, source: "CRC Handbook", certainty: "measured" },
  titanium:   { id: "titanium", name: "Titanium Alloy", c: 523, lf: 323, source: "Titanium Metals Corp", certainty: "measured" },
  nickel:     { id: "nickel", name: "Nickel", c: 444, lf: 297, source: "CRC Handbook", certainty: "measured" },
  zinc:       { id: "zinc", name: "Zinc", c: 388, lf: 112, source: "CRC Handbook", certainty: "measured" },
  platinum:   { id: "platinum", name: "Platinum", c: 133, lf: 113, source: "CRC Handbook", certainty: "measured" },
  brass:      { id: "brass", name: "Brass", c: 380, lf: 168, source: "Copper Development Assn", certainty: "approx" },
  bronze:     { id: "bronze", name: "Bronze", c: 380, source: "Copper Development Assn", certainty: "approx" },
  glass:      { id: "glass", name: "Window Glass", c: 840, source: "Schott Glass Catalog", certainty: "measured" },
  water:      { id: "water", name: "Water", c: 4186, lf: 334, source: "NIST Reference Data", certainty: "measured" },
  ice:        { id: "ice", name: "Water Ice", c: 2090, lf: 334, source: "NIST Reference Data", certainty: "measured" },
  oak:        { id: "oak", name: "Oak Wood", c: 1700, source: "USDA Wood Handbook", certainty: "approx" },
  bamboo:     { id: "bamboo", name: "Structural Bamboo", c: 1700, source: "USDA Wood Handbook", certainty: "approx" },
  concrete:   { id: "concrete", name: "Concrete", c: 880, source: "ACI Standards", certainty: "approx" },
  marble:     { id: "marble", name: "Marble", c: 880, source: "Stone Engineering Handbook", certainty: "approx" },
  granite:    { id: "granite", name: "Granite", c: 790, source: "Stone Engineering Handbook", certainty: "approx" },
  sand:       { id: "sand", name: "Dry Sand", c: 830, source: "US Army Corps of Engineers", certainty: "measured" },
  soil:       { id: "soil", name: "Loose Soil", c: 800, source: "USDA Soil Physics", certainty: "approx" },
  clay:       { id: "clay", name: "Clay", c: 880, source: "Ceramic Engineering Handbooks", certainty: "approx" },
  diamond:    { id: "diamond", name: "Diamond", c: 502, source: "Properties of Diamond DB", certainty: "measured" },
  graphite:   { id: "graphite", name: "Carbon/Graphite", c: 710, source: "Carbon Elements Properties", certainty: "approx" },
  carbonFibre:{ id: "carbonFibre", name: "Carbon Fibre", c: 710, source: "Composite Materials Handbook", certainty: "approx" },
  rubber:     { id: "rubber", name: "Rubber", c: 1600, source: "Rubber Manufacturers Assn", certainty: "approx" },
  teflon:     { id: "teflon", name: "Teflon", c: 1000, source: "DuPont Material Properties", certainty: "measured" },
  styrofoam:  { id: "styrofoam", name: "Styrofoam", c: 1300, source: "Acoustical Materials Handbook", certainty: "approx" },
  paper:      { id: "paper", name: "Paper", c: 1300, source: "Paper Physics Handbook", certainty: "approx" },
  coal:       { id: "coal", name: "Coal", c: 1300, source: "Fuel Properties Handbook", certainty: "approx" },
  cork:       { id: "cork", name: "Cork", c: 1900, source: "Cork Institute Data", certainty: "approx" },
  tungstenCarbide: { id: "tungstenCarbide", name: "Tungsten Carbide", c: 200, source: "Metal Properties Handbook", certainty: "approx" },
  aerogel:    { id: "aerogel", name: "Aerogel", c: 1000, source: "NASA JPL", certainty: "approx" },
  silicon:    { id: "silicon", name: "Silicon", c: 700, source: "NIST Reference Data", certainty: "measured" },
  quartz:     { id: "quartz", name: "Quartz", c: 740, source: "CRC Handbook", certainty: "measured" },
  salt:       { id: "salt", name: "Salt (Halite)", c: 880, source: "CRC Handbook", certainty: "measured" },
  sugar:      { id: "sugar", name: "Sugar", c: 1250, source: "Food Properties Handbook", certainty: "approx" },
  chalk:      { id: "chalk", name: "Chalk", c: 880, source: "Stone Engineering Handbook", certainty: "approx" },
};
/** Fall survival odds by height (measured/gameplay-tuned trauma statistics). */
export const FALL_ODDS: { heightM: number; odds: number; note: string }[] = [
  { heightM: 3, odds: 0.99, note: "minor leg damage if landing flat" },
  { heightM: 6, odds: 0.90, note: "major bone fractures forced" },
  { heightM: 12, odds: 0.50, note: "LD50 boundary" },
  { heightM: 25, odds: 0.01, note: "near-absolute lethal threshold" },
];

// ------------------------------------------------------- 13. uncertainty
// Every verdict number carries an error bar. rel = ±fraction (1σ engineering
// judgment), abs = ±absolute units. Sources: instrument data where measured,
// conservative judgment where approx — the bar is always shown, never hidden.
export interface UncDef extends Sourced { id: string; name: string; rel?: number; abs?: number; unit?: string }
export const UNCERTAINTY: Record<string, UncDef> = {
  range:     { id: "range", name: "Ballistic range (drag + Cd spread)", rel: 0.15, source: "drag-coefficient spread, table 13", certainty: "approx" },
  impactV:   { id: "impactV", name: "Impact velocity (air-density + step error)", rel: 0.05, source: "120 Hz integration vs closed form", certainty: "approx" },
  terminalV: { id: "terminalV", name: "Terminal velocity (CdA ±20%)", rel: 0.10, source: "drag-coefficient spread, table 13", certainty: "approx" },
  density:   { id: "density", name: "Material density (alloy/grade spread)", rel: 0.03, source: "codex table 3 grade ranges", certainty: "approx" },
  meltC:     { id: "meltC", name: "Melt point (alloy shift)", abs: 15, unit: "K", source: "codex table 4 alloy ranges", certainty: "approx" },
  specHeat:  { id: "specHeat", name: "Specific heat (temperature drift)", rel: 0.10, source: "NIST temperature dependence", certainty: "approx" },
  meltEnergy:{ id: "meltEnergy", name: "Melt energy (c + Lf stacked)", rel: 0.15, source: "SPECIFIC_HEAT propagation", certainty: "approx" },
  heatTime:  { id: "heatTime", name: "Heating time (h ±50% dominates)", rel: 0.50, source: "convection-coefficient spread", certainty: "approx" },
  gravity:   { id: "gravity", name: "Surface gravity (latitude + altitude)", rel: 0.005, source: "WGS84 variation", certainty: "measured" },
  soundDelay:{ id: "soundDelay", name: "Sound delay (temperature ±10°C)", rel: 0.02, source: "c(T) dependence, table 6", certainty: "measured" },
  orbitV:    { id: "orbitV", name: "Orbital velocity (mu + spherical assumption)", rel: 0.01, source: "JPL ephemeris + sphere approx", certainty: "approx" },
  dose:      { id: "dose", name: "Radiation dose (geometry + shielding ignored)", rel: 0.30, source: "point-source assumption", certainty: "approx" },
  toxicity:  { id: "toxicity", name: "Toxicity thresholds (individual variance)", rel: 0.25, source: "OSHA inter-individual spread", certainty: "approx" },
  fallOdds:  { id: "fallOdds", name: "Fall survival odds (trauma statistics)", rel: 0.20, source: "trauma-registry spread", certainty: "approx" },
  liftLimit: { id: "liftLimit", name: "Human strength limits (athlete spread)", rel: 0.15, source: "powerlifting record spread", certainty: "approx" },
};

// ------------------------------------------------------- 14. convection
// Convective heat-transfer coefficients h (W/m²·K) for lumped-capacitance
// heating-time estimates. Wide bands — the verdict always names its h.
export interface ConvDef extends Sourced { id: string; name: string; h: number }
export const H_CONV: Record<string, ConvDef> = {
  stillAir:  { id: "stillAir", name: "Still room air (natural convection)", h: 10, source: "Incropera Heat Transfer", certainty: "approx" },
  windyAir:  { id: "windyAir", name: "Windy air / forced fan", h: 50, source: "Incropera Heat Transfer", certainty: "approx" },
  furnace:   { id: "furnace", name: "Furnace / kiln (forced + radiation linearization)", h: 150, source: "Industrial furnace practice", certainty: "approx" },
  waterBath: { id: "waterBath", name: "Stirred water bath", h: 800, source: "Incropera Heat Transfer", certainty: "approx" },
  boiling:   { id: "boiling", name: "Boiling water (nucleate)", h: 5000, source: "Rohsenow correlation", certainty: "approx" },
  lavaBath:  { id: "lavaBath", name: "Molten lava contact (conduction-dominated)", h: 500, source: "Volcanology field estimates", certainty: "approx" },
};

// ------------------------------------------------------- 15. citations
// Exportable references for every data family. `citations` tool renders BibTeX.
export interface CiteDef { id: string; family: string; title: string; publisher: string; year: string; note: string }
export const CITATIONS: Record<string, CiteDef> = {
  nist:     { id: "nist", family: "constants, specific heat, optics", title: "NIST Reference Data for Material Properties", publisher: "National Institute of Standards and Technology", year: "2024", note: "c, n, epsilon, melt points" },
  crc:      { id: "crc", family: "electrical, corrosion, density", title: "CRC Handbook of Chemistry and Physics", publisher: "CRC Press", year: "2023", note: "conductivity, pH timelines, densities" },
  asm:      { id: "asm", family: "steel, aluminium strength", title: "ASM Materials Engineering Dictionary + AISC Steel Manual", publisher: "ASM International", year: "2022", note: "yield/ultimate, thermal" },
  isa:      { id: "isa", family: "altitude air density", title: "International Standard Atmosphere (ISA)", publisher: "ISO 2533", year: "1975", note: "0–12 km bands, exponential above" },
  jpl:      { id: "jpl", family: "orbital mu, radii, aerogel", title: "JPL Planetary and Lunar Ephemerides DE440", publisher: "NASA Jet Propulsion Laboratory", year: "2021", note: "mu + radii for 12 bodies" },
  iaea:     { id: "iaea", family: "isotopes, dose rates", title: "IAEA Nuclear Data + CDC Radiation Safety", publisher: "International Atomic Energy Agency", year: "2023", note: "half-lives, μSv/h per kg at 1 m" },
  osha:     { id: "osha", family: "gas toxicity, human limits", title: "OSHA/NIOSH Pocket Guide + ACGIH TLVs", publisher: "CDC NIOSH", year: "2024", note: "CO/H2S/Hg ppm tiers, deadlift records" },
  incropera:{ id: "incropera", family: "convection, heating time", title: "Fundamentals of Heat and Mass Transfer", publisher: "Wiley (Incropera)", year: "2017", note: "h bands, lumped capacitance" },
  schott:   { id: "schott", family: "glass optics + thermal", title: "Schott Optical Glass Catalog", publisher: "Schott AG", year: "2023", note: "n, epsilon, c for glass" },
  sae:      { id: "sae", family: "rolling resistance, tyres", title: "SAE + Bosch Automotive Handbook", publisher: "SAE International", year: "2022", note: "c_rr across 11 surfaces" },
  unesco:   { id: "unesco", family: "seawater, surface tension", title: "UNESCO Oceanographic Tables", publisher: "UNESCO", year: "2021", note: "rho, tension of water family" },
  usda:     { id: "usda", family: "wood, soil", title: "USDA Wood Handbook + Soil Physics", publisher: "US Forest Service", year: "2021", note: "oak/bamboo c, strength" },
  us76:     { id: "us76", family: "upper atmosphere 12–86 km", title: "U.S. Standard Atmosphere 1976", publisher: "NOAA/NASA/USAF", year: "1976", note: "lapse-rate layers to 86 km" },
  stefan:   { id: "stefan", family: "thermal radiation", title: "Stefan-Boltzmann law + emissivity tables", publisher: "Incropera / CRC Handbook", year: "2017", note: "σT⁴ flux, surface emissivities" },
};

// ------------------------------------------------------- 16. emissivity
// Total hemispherical emissivity (representative finish, 300–1500 K).
// Polished metals ~0.05, oxidized metals 0.4–0.8, rock/water/wood ~0.9.
export interface EmissDef extends Sourced { id: string; name: string; e: number }
export const EMISSIVITY: Record<string, EmissDef> = {
  aluminium:  { id: "aluminium", name: "Aluminium", e: 0.2, source: "Incropera Heat Transfer", certainty: "approx" },
  copper:     { id: "copper", name: "Copper", e: 0.3, source: "Incropera Heat Transfer", certainty: "approx" },
  iron:       { id: "iron", name: "Iron", e: 0.7, source: "Incropera Heat Transfer", certainty: "approx" },
  steel:      { id: "steel", name: "Structural Steel", e: 0.7, source: "ASM International", certainty: "approx" },
  lead:       { id: "lead", name: "Lead", e: 0.5, source: "CRC Handbook", certainty: "approx" },
  gold:       { id: "gold", name: "Gold", e: 0.05, source: "Incropera Heat Transfer", certainty: "measured" },
  silver:     { id: "silver", name: "Silver", e: 0.05, source: "Incropera Heat Transfer", certainty: "measured" },
  titanium:   { id: "titanium", name: "Titanium Alloy", e: 0.4, source: "Titanium Metals Corp", certainty: "approx" },
  nickel:     { id: "nickel", name: "Nickel", e: 0.3, source: "CRC Handbook", certainty: "approx" },
  zinc:       { id: "zinc", name: "Zinc", e: 0.3, source: "CRC Handbook", certainty: "approx" },
  platinum:   { id: "platinum", name: "Platinum", e: 0.15, source: "CRC Handbook", certainty: "approx" },
  brass:      { id: "brass", name: "Brass", e: 0.3, source: "Copper Development Assn", certainty: "approx" },
  bronze:     { id: "bronze", name: "Bronze", e: 0.3, source: "Copper Development Assn", certainty: "approx" },
  glass:      { id: "glass", name: "Window Glass", e: 0.9, source: "Schott Glass Catalog", certainty: "measured" },
  water:      { id: "water", name: "Water", e: 0.96, source: "NIST Reference Data", certainty: "measured" },
  ice:        { id: "ice", name: "Water Ice", e: 0.97, source: "NIST Reference Data", certainty: "measured" },
  oak:        { id: "oak", name: "Oak Wood", e: 0.9, source: "USDA Wood Handbook", certainty: "approx" },
  bamboo:     { id: "bamboo", name: "Structural Bamboo", e: 0.9, source: "USDA Wood Handbook", certainty: "approx" },
  concrete:   { id: "concrete", name: "Concrete", e: 0.9, source: "ACI Standards", certainty: "approx" },
  marble:     { id: "marble", name: "Marble", e: 0.9, source: "Stone Engineering Handbook", certainty: "approx" },
  granite:    { id: "granite", name: "Granite", e: 0.9, source: "Stone Engineering Handbook", certainty: "approx" },
  sand:       { id: "sand", name: "Dry Sand", e: 0.9, source: "US Army Corps of Engineers", certainty: "approx" },
  soil:       { id: "soil", name: "Loose Soil", e: 0.9, source: "USDA Soil Physics", certainty: "approx" },
  clay:       { id: "clay", name: "Clay", e: 0.9, source: "Ceramic Engineering Handbooks", certainty: "approx" },
  diamond:    { id: "diamond", name: "Diamond", e: 0.8, source: "Properties of Diamond DB", certainty: "approx" },
  graphite:   { id: "graphite", name: "Carbon/Graphite", e: 0.85, source: "Carbon Elements Properties", certainty: "approx" },
  carbonFibre:{ id: "carbonFibre", name: "Carbon Fibre", e: 0.85, source: "Composite Materials Handbook", certainty: "approx" },
  rubber:     { id: "rubber", name: "Rubber", e: 0.9, source: "Rubber Manufacturers Assn", certainty: "approx" },
  teflon:     { id: "teflon", name: "Teflon", e: 0.85, source: "DuPont Material Properties", certainty: "approx" },
  styrofoam:  { id: "styrofoam", name: "Styrofoam", e: 0.6, source: "Acoustical Materials Handbook", certainty: "approx" },
  paper:      { id: "paper", name: "Paper", e: 0.9, source: "Paper Physics Handbook", certainty: "approx" },
  coal:       { id: "coal", name: "Coal", e: 0.9, source: "Fuel Properties Handbook", certainty: "approx" },
  cork:       { id: "cork", name: "Cork", e: 0.9, source: "Cork Institute Data", certainty: "approx" },
  tungstenCarbide: { id: "tungstenCarbide", name: "Tungsten Carbide", e: 0.4, source: "Metal Properties Handbook", certainty: "approx" },
  aerogel:    { id: "aerogel", name: "Aerogel", e: 0.5, source: "NASA JPL", certainty: "approx" },
  silicon:    { id: "silicon", name: "Silicon", e: 0.6, source: "NIST Reference Data", certainty: "approx" },
  quartz:     { id: "quartz", name: "Quartz", e: 0.9, source: "CRC Handbook", certainty: "approx" },
  salt:       { id: "salt", name: "Salt (Halite)", e: 0.9, source: "CRC Handbook", certainty: "approx" },
  sugar:      { id: "sugar", name: "Sugar", e: 0.9, source: "Food Properties Handbook", certainty: "approx" },
  chalk:      { id: "chalk", name: "Chalk", e: 0.9, source: "Stone Engineering Handbook", certainty: "approx" },
};

// ------------------------------------------------------- 17. US Standard Atmosphere 1976
// Lapse-rate layers to 86 km (NOAA/NASA/USAF). Exact hydrostatic integration:
// L=0 → exponential, else power law. Sea-level anchors: 288.15 K, 101325 Pa.
interface US76Layer { h: number; t: number; lapse: number }
const US76: US76Layer[] = [
  { h: 0, t: 288.15, lapse: -0.0065 },
  { h: 11000, t: 216.65, lapse: 0 },
  { h: 20000, t: 216.65, lapse: 0.001 },
  { h: 32000, t: 228.65, lapse: 0.0028 },
  { h: 47000, t: 270.65, lapse: 0 },
  { h: 51000, t: 270.65, lapse: -0.0028 },
  { h: 71000, t: 214.65, lapse: -0.002 },
];
const US76_G = 9.80665, US76_R = 287.058;
function us76BaseP(i: number): number {
  let p = 101325;
  for (let k = 0; k < i; k++) {
    const L = US76[k], top = US76[k + 1].h;
    const T1 = L.t + L.lapse * (top - L.h);
    p = L.lapse === 0
      ? p * Math.exp((-US76_G * (top - L.h)) / (US76_R * L.t))
      : p * Math.pow(T1 / L.t, -US76_G / (US76_R * L.lapse));
  }
  return p;
}
/** US-1976 temperature (K), pressure (Pa), density (kg/m³) at altitude m (0–86 km). */
export function us76Atmo(altitudeM: number): { tK: number; pPa: number; rho: number } {
  const a = Math.min(86000, Math.max(0, altitudeM));
  let i = 0;
  while (i < US76.length - 1 && a >= US76[i + 1].h) i++;
  const L = US76[i];
  const T = L.t + L.lapse * (a - L.h);
  const p0 = us76BaseP(i);
  const p = L.lapse === 0
    ? p0 * Math.exp((-US76_G * (a - L.h)) / (US76_R * L.t))
    : p0 * Math.pow(T / L.t, -US76_G / (US76_R * L.lapse));
  return { tK: T, pPa: p, rho: p / (US76_R * T) };
}
