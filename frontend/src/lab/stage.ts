// Staging director: turns "throw a cube from 10m into the water" into a visible
// experiment in the LIVE world — a glass tank gets built, real fluid poured,
// the body placed 10 m above, and gravity does the rest. Watch it happen.
import { MATERIALS, FLUIDS, type EngineWorld } from "../../../engine/src/index.js";

const MAT_ALIAS: Record<string, string> = {
  wood: "oak", wooden: "oak", metal: "steel", rock: "concrete", stone: "concrete",
  plastic: "teflon", cube: "oak",
};
const FLUID_ALIAS: Record<string, string> = {
  sea: "water", ocean: "water", pool: "water", pond: "water", magma: "lava",
};

const stagedBodies = new Set<string>();
let stagedFluidStart = -1;
let stagedFluidCount = 0;

export function clearStage(world: EngineWorld): void {
  if (stagedBodies.size) {
    world.bodies = world.bodies.filter((b) => !stagedBodies.has(b.id));
    stagedBodies.clear();
  }
  if (stagedFluidCount > 0) {
    world.fluids.splice(stagedFluidStart, stagedFluidCount);
    stagedFluidStart = -1; stagedFluidCount = 0;
  }
}

function pickMaterial(p: string, exclude?: string): string {
  for (const k of Object.keys(MATERIALS)) {
    if (k === exclude) continue; // the fluid is the pool, never the body
    if (p.includes(k) || p.includes(MATERIALS[k].name.toLowerCase())) return k;
  }
  for (const [alias, id] of Object.entries(MAT_ALIAS)) {
    if (id === exclude) continue;
    if (p.includes(alias)) return id;
  }
  return "oak";
}

function pickFluid(p: string): string | null {
  for (const k of Object.keys(FLUIDS)) if (p.includes(k)) return k;
  for (const [alias, id] of Object.entries(FLUID_ALIAS)) if (p.includes(alias)) return id;
  return null;
}

/** Stage an experiment visibly. Returns narration lines, or null if not stageable. */
export function stagePrompt(world: EngineWorld, prompt: string, ax: number, az: number): string[] | null {
  const p = prompt.toLowerCase();
  const isDrop = /drop|fall|throw|launch|shoot|place|put|float|sink|swim|plop|dunk/i.test(p);
  if (!isDrop) return null;
  clearStage(world);

  const fluidId = pickFluid(p); // pool first, so the fluid is never cast as the body
  const matId = pickMaterial(p, fluidId ?? undefined);
  const mat = MATERIALS[matId];
  const shape = /sphere|ball|orb/i.test(p) ? "sphere" : "box";
  const sizeM = p.match(/(\d+(?:\.\d+)?)\s?m\s(cube|box|ball|sphere|block)/);
  const size = sizeM ? Math.min(2, Math.max(0.2, parseFloat(sizeM[1]))) : 0.5;
  const hM = p.match(/(from|above|high|up|height)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s?(m|meter|metre)/);
  const height = hM ? parseFloat(hM[2] ?? hM[3] ?? "10") : 10;
  const vM = p.match(/(\d+(?:\.\d+)?)\s?m\/s/);
  const aM = p.match(/(\d+(?:\.\d+)?)\s?(degrees|°)/);
  const throwing = /throw|launch|shoot|fire|toss|hurl/i.test(p);
  const v0 = vM ? parseFloat(vM[1]) : throwing ? 6 : 0;
  const ang = aM ? parseFloat(aM[1]) : 25;

  const lines: string[] = [];
  // Full flight time (with initial vertical velocity) so throws land mid-pool.
  const vy0 = v0 * Math.sin((ang * Math.PI) / 180);
  const vx0 = v0 * Math.cos((ang * Math.PI) / 180);
  const tFlight = (vy0 + Math.sqrt(vy0 * vy0 + 2 * 9.80665 * height)) / 9.80665;
  let surfaceY = 0;
  if (fluidId) {
    const f = FLUIDS[fluidId];
    const half = Math.max(3, vx0 * tFlight * 0.6 + 3); // pool sized to catch the throw
    const rimH = 2.2;
    surfaceY = 1.7;
    stagedFluidStart = world.fluids.length;
    world.addFluid({
      name: f.name, min: { x: ax - half, y: 0, z: az - half },
      max: { x: ax + half, y: surfaceY, z: az + half },
      density: f.density ?? 1000, viscosity: f.viscosity,
    });
    stagedFluidCount = 1;
    // Glass tank walls (static — rendered, never integrated).
    const t = 0.09, wall = (sx: number, sz: number, px: number, pz: number) => {
      const b = world.spawn({ shape: "box", material: "glass", sizeM: 1, static: true,
        scale: { x: sx, y: rimH / 2, z: sz }, pos: { x: px, y: rimH / 2, z: pz } });
      stagedBodies.add(b.id);
    };
    wall(half + t, t, ax, az - half - t); wall(half + t, t, ax, az + half + t);
    wall(t, half + t, ax - half - t, az); wall(t, half + t, ax + half + t, az);
    lines.push(`tank built at ${ax.toFixed(0)}, ${az.toFixed(0)} — ${f.name} poured to ${surfaceY} m`);
  }

  const b = (() => {
    // Lead the drop so a throw lands mid-pool: spawn up-range by vx × flight time.
    return world.spawn({
      shape, material: matId, sizeM: size,
      pos: { x: ax - vx0 * tFlight, y: surfaceY + height, z: az },
      vel: v0 ? { x: vx0, y: vy0, z: 0 } : undefined,
    });
  })();
  stagedBodies.add(b.id);
  lines.push(`${mat.name} ${shape} (${b.massKg.toFixed(0)} kg) placed ${height} m up${v0 ? `, thrown ${v0} m/s @ ${ang}°` : " — released"}`);
  lines.push(fluidId ? `watch: splash → ${mat.density < (FLUIDS[fluidId].density ?? 1e9) ? "float" : "sink"} — type watch to stream events` : `watch it fall — type watch to stream events`);
  return lines;
}
