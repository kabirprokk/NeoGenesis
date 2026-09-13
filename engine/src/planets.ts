// Planetary environments — codex tables 2 + 8. Fields absent where the codex gives none.
// mu (m³/s²) + radiusM (m) are NASA/JPL ephemeris values for orbital mechanics.
export interface PlanetDef {
  id: string; name: string; gravity: number; pressureAtm: number | null;
  tempC: number | null; escapeKms: number | null; hazard: string | null;
  mu?: number; radiusM?: number;
}
export const PLANETS: Record<string, PlanetDef> = {
  mercury: { id: "mercury", name: "Mercury", gravity: 3.7, pressureAtm: 0.000001, tempC: 167, escapeKms: 4.3, hazard: null, mu: 2.2032e13, radiusM: 2.4397e6 },
  venus:   { id: "venus", name: "Venus", gravity: 8.87, pressureAtm: 92, tempC: 464, escapeKms: 10.4, hazard: "crushing pressure, acid heat", mu: 3.2486e14, radiusM: 6.0518e6 },
  earth:   { id: "earth", name: "Earth", gravity: 9.81, pressureAtm: 1, tempC: 15, escapeKms: 11.2, hazard: null, mu: 3.986004e14, radiusM: 6.371e6 },
  moon:    { id: "moon", name: "Moon", gravity: 1.62, pressureAtm: 0, tempC: -20, escapeKms: 2.4, hazard: "vacuum, radiation", mu: 4.9049e12, radiusM: 1.7374e6 },
  mars:    { id: "mars", name: "Mars", gravity: 3.72, pressureAtm: 0.006, tempC: -65, escapeKms: 5.0, hazard: "thin air, cold", mu: 4.2828e13, radiusM: 3.3895e6 },
  jupiter: { id: "jupiter", name: "Jupiter", gravity: 24.79, pressureAtm: null, tempC: -110, escapeKms: 59.5, hazard: "no solid surface", mu: 1.26686e17, radiusM: 6.9911e7 },
  saturn:  { id: "saturn", name: "Saturn", gravity: 10.44, pressureAtm: 1000, tempC: -140, escapeKms: null, hazard: "gas giant, no solid surface", mu: 3.79312e16, radiusM: 5.8232e7 },
  titan:   { id: "titan", name: "Titan", gravity: 1.35, pressureAtm: 1.45, tempC: -179, escapeKms: null, hazard: "liquid methane oceans", mu: 8.978e12, radiusM: 2.575e6 },
  uranus:  { id: "uranus", name: "Uranus", gravity: 8.69, pressureAtm: 100, tempC: -195, escapeKms: null, hazard: "extreme axial tilt", mu: 5.7939e15, radiusM: 2.5362e7 },
  neptune: { id: "neptune", name: "Neptune", gravity: 11.15, pressureAtm: 100, tempC: -200, escapeKms: null, hazard: "2100 km/h winds", mu: 6.8365e15, radiusM: 2.4622e7 },
  pluto:   { id: "pluto", name: "Pluto", gravity: 0.62, pressureAtm: 0.00001, tempC: -225, escapeKms: null, hazard: "nitrogen ice glaciers", mu: 8.71e11, radiusM: 1.1883e6 },
  sun:     { id: "sun", name: "Sun", gravity: 274, pressureAtm: null, tempC: 5500, escapeKms: null, hazard: "absolute vaporisation", mu: 1.327124e20, radiusM: 6.957e8 },
};
