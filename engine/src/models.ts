// Model registry: 12,000 deterministic variants (12 classes × 10 materials ×
// 10 sizes × 10 configs). Nothing stored — every entry derives from its index,
// so an AI can address any of 10,000+ models by id and get identical physics.
// Lineage: grows out of neo_genesis_model_matrix.json (105 aerospace + maritime
// variants) into a full combinatorial matrix.
import { MATERIALS, DRAG_CD } from "./materials.js";
import type { EngineWorld } from "./world.js";

export const MODEL_CLASSES = [
  "aerospace", "maritime", "crate", "sphere-probe", "beam", "plate-armor",
  "tool", "container", "ingot", "shell", "habitat-module", "ballast",
] as const;
const MODEL_MATS = ["steel", "aluminium", "titanium", "oak", "concrete", "glass", "lead", "gold", "copper", "carbonFibre"] as const;
const SIZE_M = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 8];
const PROFILES = ["airfoil", "fighterJet", "sphere", "bullet", "cube", "plate", "parachute"] as const;

export const MODEL_COUNT = 12 * 10 * 10 * 10; // 12,000

export interface ModelEntry {
  index: number; id: string; class: string; material: string;
  sizeM: number; volumeM3: number; massKg: number;
  dragProfile: string; dragCd: number;
  yieldMpa: number | null; displacementM3: number;
}

export function getModel(index: number): ModelEntry {
  const i = ((index % MODEL_COUNT) + MODEL_COUNT) % MODEL_COUNT;
  const cls = MODEL_CLASSES[i % 12];
  const mat = MODEL_MATS[Math.floor(i / 12) % 10];
  const sizeM = SIZE_M[Math.floor(i / 120) % 10];
  const cfg = Math.floor(i / 1200) % 10;
  const def = MATERIALS[mat];
  const spherical = cls === "sphere-probe" || cls === "ballast";
  const volumeM3 = spherical ? (4 / 3) * Math.PI * sizeM ** 3 : (2 * sizeM) ** 3 * (0.5 + cfg * 0.1);
  const dragProfile = PROFILES[(cfg + (spherical ? 2 : 4)) % PROFILES.length];
  return {
    index: i, id: `NEO-${1001 + i}`, class: cls, material: mat,
    sizeM, volumeM3, massKg: def.density * volumeM3,
    dragProfile, dragCd: DRAG_CD[dragProfile],
    yieldMpa: def.yieldMpa ?? def.tensileMpa ?? null,
    displacementM3: volumeM3,
  };
}

/** Spawn a registry model into a world at a position. Returns the body id. */
export function spawnModel(world: EngineWorld, index: number, pos?: { x: number; y: number; z: number }): string {
  const m = getModel(index);
  const b = world.spawn({
    shape: m.class === "sphere-probe" || m.class === "ballast" ? "sphere" : "box",
    material: m.material, sizeM: m.sizeM, pos,
    dragProfile: m.dragProfile, massOverrideKg: m.massKg,
  });
  b.id = m.id;
  return b.id;
}
