// Lab environment — the plane is a laboratory, not a planet. One human, always.
// The sky keeps real sun/moon math (time-of-day is a lab condition); there are
// no eras, no biomes, no fauna. Ever.
export const ONE_HUMAN_RULE =
  "There is exactly one human (the player). Never spawn human NPCs." as const;

export interface AtmosphereParams {
  co2ppm: number; o2frac: number; surfacePressureHpa: number;
  rayleigh: [number, number, number]; mieG: number; mieStrength: number;
}
export interface LabEnvironment {
  id: "laboratory-earth"; label: string; description: string;
  dayLengthHours: number; obliquityDeg: number;
  atmosphere: AtmosphereParams;
}

export const DEFAULT_ERA: LabEnvironment = {
  id: "laboratory-earth", label: "Laboratory Earth (only)",
  description: "Sea-level standard air under a real sun. The plane, the rig, the numbers.",
  dayLengthHours: 24, obliquityDeg: 23.44,
  atmosphere: { co2ppm: 1000, o2frac: 0.21, surfacePressureHpa: 1013.25,
    rayleigh: [5.8e-6, 13.5e-6, 33.1e-6], mieG: 0.76, mieStrength: 0.9 },
};
