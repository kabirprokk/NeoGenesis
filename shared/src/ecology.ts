// Ecology types: species definitions, food web, LOD tiers. No human species allowed.
export type Diet = "herbivore" | "predator" | "scavenger" | "omnivore";
export type Sociality = "herd" | "solitary" | "pack";
export type SimTier = "LOCAL" | "REGIONAL" | "GLOBAL";

export interface SpeciesDef {
  id: string; name: string; morphotype: string;
  diet: Diet; sociality: Sociality;
  habitatBiomes: string[]; tempRangeC: [number, number];
  waterNeed01: number; territoryKm2: number;
  nocturnal: boolean; migratory: boolean; defensive: boolean;
  aggression01: number; speedMs: number; massKg: number;
  preyOf: string[]; eats: string[];
  fearRadiusM: number;
  notes: string; // artistic-approximation disclaimer per species
}

export const SPECIES: SpeciesDef[] = [
  { id: "hadrosaur-herd", name: "Hadrosaur-like grazer", morphotype: "hadrosaurid analogue (artistic)",
    diet: "herbivore", sociality: "herd", habitatBiomes: ["grassland", "forest", "wetland", "jungle"],
    tempRangeC: [8, 34], waterNeed01: 0.7, territoryKm2: 25, nocturnal: false, migratory: true,
    defensive: true, aggression01: 0.15, speedMs: 9, massKg: 3500, preyOf: ["tyrannosaur-like"], eats: ["plants"],
    fearRadiusM: 120, notes: "Herd defensive circle; usually observable without attack." },
  { id: "ceratopsian-herd", name: "Ceratopsian-like defender", morphotype: "ceratopsian analogue (artistic)",
    diet: "herbivore", sociality: "herd", habitatBiomes: ["grassland", "shrubland"],
    tempRangeC: [5, 32], waterNeed01: 0.6, territoryKm2: 15, nocturnal: false, migratory: false,
    defensive: true, aggression01: 0.35, speedMs: 7, massKg: 5000, preyOf: ["tyrannosaur-like"], eats: ["plants"],
    fearRadiusM: 80, notes: "Territorial when young present; charges only when pressed." },
  { id: "tyrannosaur-like", name: "Tyrannosaur-like predator", morphotype: "large theropod analogue (artistic)",
    diet: "predator", sociality: "solitary", habitatBiomes: ["grassland", "forest", "shrubland"],
    tempRangeC: [5, 32], waterNeed01: 0.5, territoryKm2: 150, nocturnal: false, migratory: false,
    defensive: false, aggression01: 0.6, speedMs: 11, massKg: 7000, preyOf: [], eats: ["hadrosaur-herd", "ceratopsian-herd"],
    fearRadiusM: 0, notes: "State-dependent hunter; not permanently aggro. Avoidance usually works." },
  { id: "raptor-pack", name: "Raptor-like pack hunter", morphotype: "dromaeosaur analogue (artistic)",
    diet: "predator", sociality: "pack", habitatBiomes: ["forest", "shrubland", "jungle"],
    tempRangeC: [10, 34], waterNeed01: 0.5, territoryKm2: 40, nocturnal: true, migratory: false,
    defensive: false, aggression01: 0.55, speedMs: 12, massKg: 80, preyOf: ["tyrannosaur-like"], eats: ["small-herbivore", "hadrosaur-herd"],
    fearRadiusM: 60, notes: "Nocturnal; flees larger predators." },
  { id: "small-herbivore", name: "Small ornithischian browser", morphotype: "small herbivore analogue (artistic)",
    diet: "herbivore", sociality: "herd", habitatBiomes: ["forest", "jungle", "wetland"],
    tempRangeC: [10, 34], waterNeed01: 0.6, territoryKm2: 3, nocturnal: false, migratory: false,
    defensive: false, aggression01: 0.05, speedMs: 8, massKg: 40, preyOf: ["raptor-pack", "tyrannosaur-like"], eats: ["plants"],
    fearRadiusM: 60, notes: "Skittish; first wildlife the player usually meets." },
  { id: "pterosaur-soarer", name: "Pterosaur-like soarer", morphotype: "azhdarchid analogue (artistic)",
    diet: "scavenger", sociality: "solitary", habitatBiomes: ["desert", "grassland", "wetland"],
    tempRangeC: [10, 36], waterNeed01: 0.3, territoryKm2: 300, nocturnal: false, migratory: true,
    defensive: false, aggression01: 0.08, speedMs: 18, massKg: 200, preyOf: [], eats: ["carrion", "small-herbivore"],
    fearRadiusM: 150, notes: "Circles thermals; lands to scavenge." },
  { id: "mammoth-herd", name: "Mammoth-like megaherbivore", morphotype: "ice-age preset only (artistic)",
    diet: "herbivore", sociality: "herd", habitatBiomes: ["tundra", "grassland", "boreal"],
    tempRangeC: [-30, 12], waterNeed01: 0.6, territoryKm2: 200, nocturnal: false, migratory: true,
    defensive: true, aggression01: 0.25, speedMs: 6, massKg: 6000, preyOf: [], eats: ["plants"],
    fearRadiusM: 100, notes: "Only enabled in ice-age-inspired preset." },
];

export interface CohortState { speciesId: string; cellKey: string; count: number; biomassKg: number; trend: number }
export interface EcoTickInput { dtDays: number; carryingCapacity: number; cohorts: CohortState[] }

// Regional tick: logistic growth + predation + water stress (simplified Lotka-Volterra-ish).
export function tickCohorts(inp: EcoTickInput): CohortState[] {
  return inp.cohorts.map((c) => {
    const def = SPECIES.find((s) => s.id === c.speciesId);
    const r = def?.diet === "predator" ? 0.02 : 0.08;
    const growth = r * c.count * (1 - c.count / Math.max(1, inp.carryingCapacity));
    const predation = def?.diet === "herbivore" ? -0.01 * c.count : 0.005 * c.count;
    const next = Math.max(0, c.count + (growth + predation) * inp.dtDays);
    return { ...c, count: next, trend: next - c.count };
  });
}

export const FOOD_WEB = "plants → herbivores → predators → scavengers → decomposition";
