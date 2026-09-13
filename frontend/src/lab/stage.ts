// Staging director: turns "throw a copper sphere from 100m into the water" into
// a visible experiment in the LIVE world — Neo builds the rig (tank, fluid,
// bodies, heat), gravity does the rest, and the player watches it happen.
//
// Two entries: stagePrompt (legacy drop/throw path, kept for `do`) and
// stageNeo (every Neo action). Both track staged bodies/fluids for cleanup.
import { MATERIALS, FLUIDS, PLANETS, ACIDS, type EngineWorld } from "../../../engine/src/index.js";
import type { NeoPlan } from "../../../engine/src/index.js";

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

/** Glass tank + real fluid pool at (ax, az). Returns the fluid surface height. */
function buildTank(world: EngineWorld, fluidId: string, ax: number, az: number, half: number, lines: string[]): number {
  const f = FLUIDS[fluidId];
  const rimH = 2.2;
  const surfaceY = 1.7;
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
  return surfaceY;
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
    const half = Math.max(3, vx0 * tFlight * 0.6 + 3); // pool sized to catch the throw
    surfaceY = buildTank(world, fluidId, ax, az, half, lines);
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

export interface NeoStaging { lines: string[]; focus: { x: number; z: number } }

/**
 * Stage a Neo plan visibly in the live world. Every action builds its rig:
 * pools for fluids, pre-heated bodies for melt/burn, a crusher for crush,
 * launch velocity for slide/blast, a stack for build. Returns narration +
 * the point the camera should face.
 */
export function stageNeo(world: EngineWorld, plan: NeoPlan, ax: number, az: number): NeoStaging {
  clearStage(world);
  const lines: string[] = [];
  const mat = MATERIALS[plan.material];
  const size = Math.min(2, Math.max(0.2, plan.sizeM));
  const H = plan.heightM ?? 10;

  // Planet gravity for the live rig (a Mars throw arcs like Mars).
  const pl = PLANETS[plan.planet];
  if (pl) world.env.gravity = pl.gravity;

  const spawnBody = (opts: Parameters<EngineWorld["spawn"]>[0]) => {
    const b = world.spawn(opts);
    stagedBodies.add(b.id);
    return b;
  };

  // Fluid pool when the target is a fluid (sized to catch throws).
  let surfaceY = 0;
  if (plan.target.kind === "fluid" && plan.target.fluid) {
    const v0 = plan.action === "throw" ? (plan.velMs ?? 6) : 0;
    const ang = plan.angleDeg ?? 25;
    const vy0 = v0 * Math.sin((ang * Math.PI) / 180);
    const vx0 = v0 * Math.cos((ang * Math.PI) / 180);
    const tF = (vy0 + Math.sqrt(vy0 * vy0 + 2 * world.env.gravity * H)) / world.env.gravity;
    surfaceY = buildTank(world, plan.target.fluid, ax, az, Math.max(3, vx0 * tF * 0.6 + 3), lines);
  }

  switch (plan.action) {
    case "throw": {
      const v0 = plan.velMs ?? 6, ang = plan.angleDeg ?? 25;
      const vy0 = v0 * Math.sin((ang * Math.PI) / 180);
      const vx0 = v0 * Math.cos((ang * Math.PI) / 180);
      const tF = (vy0 + Math.sqrt(vy0 * vy0 + 2 * world.env.gravity * H)) / world.env.gravity;
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax - vx0 * tF, y: surfaceY + H, z: az }, vel: { x: vx0, y: vy0, z: 0 },
        dragProfile: plan.shape === "sphere" ? "sphere" : "cube" });
      lines.push(`${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) thrown ${v0} m/s @ ${ang}° from ${H} m`);
      break;
    }
    case "melt": case "burn": case "boil": {
      const demo = plan.tempC ?? mat.meltC ?? mat.ignitionC ?? 500;
      world.env.ambientC = demo + 50; // chamber holds the heat
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: size, z: az }, tempC: demo + 50 });
      lines.push(`heat chamber at ${demo + 50}°C — ${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) placed inside`);
      lines.push(mat.meltC !== undefined && demo + 50 >= mat.meltC ? "watch it MELT — glowing puddle, live" : "watch the verdict: this heat cannot melt it");
      break;
    }
    case "freeze": {
      world.env.ambientC = -30;
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: size, z: az }, tempC: -30 });
      lines.push(`cold chamber at -30°C — ${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) placed inside`);
      lines.push("honest limit: the engine has no freeze kinetics yet — cold is staged, verdict is thermal math");
      break;
    }
    case "crush": {
      const target = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: size, z: az } });
      const crusher = spawnBody({ shape: "box", material: "steel", sizeM: 1.5,
        pos: { x: ax, y: size * 2 + H, z: az } });
      lines.push(`${mat.name} ${plan.shape} (${target.massKg.toFixed(0)} kg) on the ground`);
      lines.push(`steel crusher (${crusher.massKg.toFixed(0)} kg) dropped from ${H} m — impact verdict is per-body vs ground`);
      break;
    }
    case "slide": {
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax - 6, y: size, z: az }, vel: { x: 8, y: 0, z: 0 } });
      lines.push(`${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) sliding at 8 m/s — friction bleeds it live`);
      break;
    }
    case "blast": {
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: 30, z: az }, vel: { x: 0, y: -25, z: 0 } });
      lines.push(`${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) slammed down at 25 m/s — blast impact, live`);
      break;
    }
    case "build": {
      for (let i = 0; i < 3; i++) {
        spawnBody({ shape: "box", material: plan.material, sizeM: size,
          pos: { x: ax, y: size + i * size * 2, z: az } });
      }
      lines.push(`Neo stacked 3 × ${mat.name} blocks (${size} m) — a wall, built live`);
      break;
    }
    case "scratch": {
      const tool = spawnBody({ shape: "box", material: plan.material, sizeM: size,
        pos: { x: ax - size * 1.5, y: size, z: az } });
      spawnBody({ shape: "box", material: "glass", sizeM: size, pos: { x: ax + size * 1.5, y: size, z: az } });
      const tMohs = mat.mohs, gMohs = MATERIALS.glass.mohs!;
      lines.push(`${mat.name} tool (Mohs ${tMohs ?? "?"}) vs glass block (Mohs ${gMohs})`);
      lines.push(tMohs !== undefined && tMohs >= gMohs ? "tool wins — it scratches the glass (verdict has the math)" : "tool loses — glass wins (verdict has the math)");
      void tool;
      break;
    }
    case "pour": {
      const f = FLUIDS[plan.pourFluid ?? "water"];
      lines.push(`${f.name} poured live — pool is real fluid (buoyancy + viscosity on)`);
      lines.push("drop something in: type it in the Neo bar, e.g. “sink lead in water”");
      break;
    }
    case "electrify": {
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: size, z: az } });
      lines.push(`${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) wired into the spark gap`);
      lines.push("throw the switch in the verdict below — conductivity vs breakdown, live numbers");
      break;
    }
    case "dissolve": {
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: size, z: az } });
      const acidName = plan.acid && ACIDS[plan.acid] ? ACIDS[plan.acid].name : "acid";
      lines.push(`${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) lowered toward ${acidName}`);
      lines.push("honest limit: the engine has no corrosion kinetics yet — the bath is staged, the timeline verdict is real table data");
      break;
    }
    case "lase": {
      spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: size, z: az } });
      lines.push(`${mat.name} ${plan.shape} on the optical bench — beam path staged`);
      lines.push("Snell bend angle is in the verdict — glass bends, diamond traps light");
      break;
    }
    case "roll": {
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax - 6, y: size, z: az }, vel: { x: 10, y: 0, z: 0 } });
      lines.push(`${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) rolling at 10 m/s — resistance bleeds it live`);
      break;
    }
    default: { // drop / float / sink
      const b = spawnBody({ shape: plan.shape, material: plan.material, sizeM: size,
        pos: { x: ax, y: surfaceY + H, z: az } });
      lines.push(`${mat.name} ${plan.shape} (${b.massKg.toFixed(0)} kg) released from ${H} m`);
      if (plan.target.kind === "fluid" && plan.target.fluid) {
        const f = FLUIDS[plan.target.fluid];
        lines.push(`watch: splash → ${mat.density < (f.density ?? 1e9) ? "float" : "sink"}`);
      } else {
        lines.push("watch it fall — impact vs strength, live");
      }
    }
  }
  return { lines, focus: { x: ax, z: az } };
}
