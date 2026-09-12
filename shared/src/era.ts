// WorldEraConfig — modular prehistoric world state. One human, always.
export const ONE_HUMAN_RULE =
  "There is exactly one human (the player). Never spawn human NPCs." as const;

export type EraPresetId =
  | "alternate-prehuman-earth"
  | "ancient-earth"
  | "jurassic-inspired"
  | "cretaceous-inspired"
  | "ice-age-inspired";

export interface AtmosphereParams {
  co2ppm: number; o2frac: number; surfacePressureHpa: number;
  rayleigh: [number, number, number]; mieG: number; mieStrength: number;
}
export interface WorldEraConfig {
  id: EraPresetId; label: string; description: string;
  dayLengthHours: number; obliquityDeg: number;
  seaLevelM: number; iceSheets: boolean;
  atmosphere: AtmosphereParams;
  floraNotes: string; faunaNotes: string;
  gameplayNotes: string;
}

export const ERA_PRESETS: Record<EraPresetId, WorldEraConfig> = {
  "alternate-prehuman-earth": {
    id: "alternate-prehuman-earth", label: "Alternate Prehuman Earth (default)",
    description: "Cretaceous-inspired greenhouse on modern geography (documented anachronism).",
    dayLengthHours: 24, obliquityDeg: 23.44, seaLevelM: 0, iceSheets: false,
    atmosphere: { co2ppm: 1000, o2frac: 0.21, surfacePressureHpa: 1013.25,
      rayleigh: [5.8e-6, 13.5e-6, 33.1e-6], mieG: 0.76, mieStrength: 0.9 },
    floraNotes: "Angiosperm lowlands + gymnosperm/fern understory; no dominant grasses (stand-in cover only).",
    faunaNotes: "Representative dinosaur morphotypes; behavior state-dependent, not arcade-aggro.",
    gameplayNotes: "No ice; warm poles; lush mid-latitudes.",
  },
  "jurassic-inspired": {
    id: "jurassic-inspired", label: "Jurassic-inspired",
    description: "Morrison-like floodplains; sauropods + theropods; gymnosperm-dominated.",
    dayLengthHours: 24, obliquityDeg: 23.5, seaLevelM: 0, iceSheets: false,
    atmosphere: { co2ppm: 1200, o2frac: 0.21, surfacePressureHpa: 1013.25,
      rayleigh: [5.8e-6, 13.5e-6, 33.1e-6], mieG: 0.76, mieStrength: 1.0 },
    floraNotes: "Conifer/cycad/fern dominated.", faunaNotes: "Sauropod herds, allosaur-like predators.",
    gameplayNotes: "Vast floodplains, braided rivers.",
  },
  "cretaceous-inspired": {
    id: "cretaceous-inspired", label: "Cretaceous-inspired",
    description: "Hell Creek-like end-Cretaceous assemblage.",
    dayLengthHours: 24, obliquityDeg: 23.44, seaLevelM: 0, iceSheets: false,
    atmosphere: { co2ppm: 1000, o2frac: 0.21, surfacePressureHpa: 1013.25,
      rayleigh: [5.8e-6, 13.5e-6, 33.1e-6], mieG: 0.76, mieStrength: 0.9 },
    floraNotes: "Spreading angiosperms.", faunaNotes: "Tyrannosaur/hadrosaur/ceratopsian morphotypes.",
    gameplayNotes: "Coastal plains, swamps.",
  },
  "ice-age-inspired": {
    id: "ice-age-inspired", label: "Ice Age-inspired",
    description: "Late Pleistocene ~20 ka: ice sheets, low sea level, megafauna mammals.",
    dayLengthHours: 24, obliquityDeg: 23.44, seaLevelM: -120, iceSheets: true,
    atmosphere: { co2ppm: 190, o2frac: 0.21, surfacePressureHpa: 1013.25,
      rayleigh: [5.5e-6, 13.0e-6, 32.4e-6], mieG: 0.76, mieStrength: 0.7 },
    floraNotes: "Tundra/steppe/forest mosaic.", faunaNotes: "Mammoths, sabertooths, bison-like herds.",
    gameplayNotes: "Cold survival; snow/ice systems active.",
  },
  "ancient-earth": {
    id: "ancient-earth", label: "Ancient Earth",
    description: "Generic deep-time procedural world.",
    dayLengthHours: 23.5, obliquityDeg: 23.5, seaLevelM: 0, iceSheets: false,
    atmosphere: { co2ppm: 1500, o2frac: 0.18, surfacePressureHpa: 1010,
      rayleigh: [6.0e-6, 14.0e-6, 34.0e-6], mieG: 0.76, mieStrength: 1.1 },
    floraNotes: "Procedural archosaur flora.", faunaNotes: "Procedural fauna.",
    gameplayNotes: "Experimental.",
  },
};

export const DEFAULT_ERA: WorldEraConfig = ERA_PRESETS["alternate-prehuman-earth"];
