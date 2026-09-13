// Fundamental physics constants. Real values, no tuning.
// Table 1 of the NeoGenesis physics codex.
export const PHYSICS: Record<string, number> = {
  /** Standard gravity, m/s² */
  G_EARTH: 9.80665,
  /** Speed of light, m/s */
  C: 299792458,
  /** Gravitational constant, N·m²/kg² */
  G: 6.67430e-11,
  /** Standard atmospheric pressure, Pa */
  P_ATM: 101325,
  /** Absolute zero, °C */
  ABS_ZERO_C: -273.15,
  /** Human terminal velocity belly-to-earth, m/s */
  HUMAN_TERMINAL_V: 54,
  /** Speed of sound in air at 20°C, m/s */
  SOUND_AIR: 343,
  /** Air density at sea level, kg/m³ */
  AIR_DENSITY: 1.225,
  /** Water density, kg/m³ */
  WATER_DENSITY: 1000,
  /** Stefan-Boltzmann constant, W/m²·K⁴ */
  STEFAN_BOLTZMANN: 5.670374419e-8,
  /** Specific gas constant of dry air, J/kg·K */
  R_AIR: 287.058,
  /** Sea-level speed of sound reference temperature, °C */
  SOUND_REF_C: 20,
};

/** Codex dataset version — bumped whenever table data changes. Stamped on every verdict. */
export const CODEX_VERSION = "1.5.0";
