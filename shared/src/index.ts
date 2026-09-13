export * from "./era.js";
export * from "./geo.js";
export * from "./astro.js";

// Save/journal shared shapes (browser-local storage agrees here).
export interface PlayerSave {
  playerId: string; lat: number; lon: number; alt: number;
  health: number; hunger: number; thirst: number; stamina: number; sleep: number; bodyTempC: number;
  inventory: Record<string, number>; eraPreset: string; epochMs: number; updatedAt: string;
}
export interface Discovery { id?: string; playerId: string; kind: string; name: string; lat: number; lon: number; data?: Record<string, unknown>; foundAt?: string }
export interface JournalEntry { id?: string; playerId: string; title: string; body: string; lat?: number; lon?: number; createdAt?: string }
