// Model registry: 27,200,000 deterministic variants
// (34 classes × 20 materials × 16 sizes × 10 configs × 10 ballast fills ×
// 25 liveries). Nothing stored — every entry derives from its index, so an AI
// can address any model by id and get identical physics. Lineage: grows out of
// neo_genesis_model_matrix.json (105 aerospace + maritime variants) into a
// full combinatorial matrix.
//
// Honesty note: five axes move physics (class, material, size, config, fill);
// livery is a cosmetic serial only — it changes the nameplate, never the
// numbers, and is labeled as such wherever shown.
import { MATERIALS, DRAG_CD } from "./materials.js";
import type { EngineWorld } from "./world.js";

export const MODEL_CLASSES = [
  "aerospace", "maritime", "crate", "sphere-probe", "beam", "plate-armor",
  "tool", "container", "ingot", "shell", "habitat-module", "ballast",
  "wedge-ramp", "dome", "arch", "truss", "capsule", "turbine",
  "tank-vessel", "pipe-run", "dragon", "ufo", "kraken", "buoy",
  "humanoid", "vehicle", "spaceship", "castle", "house", "sword",
  "shield", "chair", "table", "robot",
] as const;
const MODEL_MATS = ["steel", "aluminium", "titanium", "oak", "concrete", "glass", "lead", "gold", "copper", "carbonFibre",
  "iron", "bronze", "brass", "silver", "nickel", "granite", "marble", "rubber", "ice", "silicon"] as const;
const SIZE_M = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 8, 10, 12, 15, 20, 30];
const PROFILES = ["airfoil", "fighterJet", "sphere", "bullet", "cube", "plate", "parachute"] as const;
/** Ballast fill 0.1–1.0: hollow shell vs fully loaded — moves mass, honestly. */
const FILLS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
/** Cosmetic serials L01–L25: nameplate only, zero physics effect. */
const LIVERIES = 25;

const N_CLASS = MODEL_CLASSES.length; // 34
const N_MAT = MODEL_MATS.length; // 20
const N_SIZE = SIZE_M.length; // 16
const N_CFG = 10;
const N_FILL = FILLS.length; // 10

export const MODEL_COUNT = N_CLASS * N_MAT * N_SIZE * N_CFG * N_FILL * LIVERIES; // 27,200,000

const SPHERICAL = new Set(["sphere-probe", "ballast", "buoy"]);

export interface ModelEntry {
  index: number; id: string; class: string; material: string;
  sizeM: number; volumeM3: number; massKg: number;
  dragProfile: string; dragCd: number;
  yieldMpa: number | null; displacementM3: number;
  fillFrac: number; livery: string;
}

export function getModel(index: number): ModelEntry {
  const i = ((index % MODEL_COUNT) + MODEL_COUNT) % MODEL_COUNT;
  const cls = MODEL_CLASSES[i % N_CLASS];
  const mat = MODEL_MATS[Math.floor(i / N_CLASS) % N_MAT];
  const sizeM = SIZE_M[Math.floor(i / (N_CLASS * N_MAT)) % N_SIZE];
  const cfg = Math.floor(i / (N_CLASS * N_MAT * N_SIZE)) % N_CFG;
  const fill = FILLS[Math.floor(i / (N_CLASS * N_MAT * N_SIZE * N_CFG)) % N_FILL];
  const liv = Math.floor(i / (N_CLASS * N_MAT * N_SIZE * N_CFG * N_FILL)) % LIVERIES;
  const def = MATERIALS[mat];
  const spherical = SPHERICAL.has(cls);
  const volumeM3 = spherical ? (4 / 3) * Math.PI * sizeM ** 3 : (2 * sizeM) ** 3 * (0.5 + cfg * 0.1);
  const dragProfile = PROFILES[(cfg + (spherical ? 2 : 4)) % PROFILES.length];
  return {
    index: i, id: `NEO-${1001 + i}`, class: cls, material: mat,
    sizeM, volumeM3, massKg: def.density * volumeM3 * (0.15 + 0.85 * fill),
    dragProfile, dragCd: DRAG_CD[dragProfile],
    yieldMpa: def.yieldMpa ?? def.tensileMpa ?? null,
    displacementM3: volumeM3,
    fillFrac: fill, livery: `L${String(liv + 1).padStart(2, "0")}`,
  };
}

/** Spawn a registry model into a world at a position. Returns the body id. */
export function spawnModel(world: EngineWorld, index: number, pos?: { x: number; y: number; z: number }): string {
  const m = getModel(index);
  const b = world.spawn({
    shape: SPHERICAL.has(m.class) ? "sphere" : "box",
    material: m.material, sizeM: m.sizeM, pos,
    dragProfile: m.dragProfile, massOverrideKg: m.massKg,
  });
  b.id = m.id;
  b.modelClass = m.class;
  return b.id;
}
