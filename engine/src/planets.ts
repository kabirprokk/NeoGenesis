// Planetary environments — codex tables 2 + 8. Fields absent where the codex gives none.
export interface PlanetDef {
  id: string; name: string; gravity: number; pressureAtm: number | null;
  tempC: number | null; escapeKms: number | null; hazard: string | null;
}
export const PLANETS: Record<string, PlanetDef> = {
  mercury: { id: "mercury", name: "Mercury", gravity: 3.7, pressureAtm: 0.000001, tempC: 167, escapeKms: 4.3, hazard: null },
  venus:   { id: "venus", name: "Venus", gravity: 8.87, pressureAtm: 92, tempC: 464, escapeKms: 10.4, hazard: "crushing pressure, acid heat" },
  earth:   { id: "earth", name: "Earth", gravity: 9.81, pressureAtm: 1, tempC: 15, escapeKms: 11.2, hazard: null },
  moon:    { id: "moon", name: "Moon", gravity: 1.62, pressureAtm: 0, tempC: -20, escapeKms: 2.4, hazard: "vacuum, radiation" },
  mars:    { id: "mars", name: "Mars", gravity: 3.72, pressureAtm: 0.006, tempC: -65, escapeKms: 5.0, hazard: "thin air, cold" },
  jupiter: { id: "jupiter", name: "Jupiter", gravity: 24.79, pressureAtm: null, tempC: -110, escapeKms: 59.5, hazard: "no solid surface" },
  saturn:  { id: "saturn", name: "Saturn", gravity: 10.44, pressureAtm: 1000, tempC: -140, escapeKms: null, hazard: "gas giant, no solid surface" },
  titan:   { id: "titan", name: "Titan", gravity: 1.35, pressureAtm: 1.45, tempC: -179, escapeKms: null, hazard: "liquid methane oceans" },
  uranus:  { id: "uranus", name: "Uranus", gravity: 8.69, pressureAtm: 100, tempC: -195, escapeKms: null, hazard: "extreme axial tilt" },
  neptune: { id: "neptune", name: "Neptune", gravity: 11.15, pressureAtm: 100, tempC: -200, escapeKms: null, hazard: "2100 km/h winds" },
  pluto:   { id: "pluto", name: "Pluto", gravity: 0.62, pressureAtm: 0.00001, tempC: -225, escapeKms: null, hazard: "nitrogen ice glaciers" },
  sun:     { id: "sun", name: "Sun", gravity: 274, pressureAtm: null, tempC: 5500, escapeKms: null, hazard: "absolute vaporisation" },
};
