// Staging director: turns a Neo plan into a visible experiment in the LIVE
// world — Neo builds the rig (tank, fluid, bodies, heat), gravity does the
// rest, and the player watches it happen. Staged bodies/fluids are tracked
// for cleanup on the next run. Multi-body plans stage a crowd, spread along x.
import { MATERIALS, FLUIDS, PLANETS, ACIDS, type EngineWorld } from "../../../engine/src/index.js";
import type { NeoPlan } from "../../../engine/src/index.js";

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

/** Glass tank + real fluid pool at (ax, az). Returns the fluid surface height. */
function buildTank(world: EngineWorld, fluidId: string, ax: number, az: number, half: number, lines: string[]): number {
  const f = FLUIDS[fluidId];
  const rimH = 2.2;
  const surfaceY = 1.7;
  stagedFluidStart = world.fluids.length;
  world.addFluid({
    name: f.name, min: { x: ax - half, y: 0, z: az - half },
    max: { x: ax + half, y: surfaceY, z: az + half },
    density: f.density ?? 1000, viscosity: f.viscosity, tempC: f.tempC,
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
  // Staged-tank capacity report: interior × depth × density, same math as the verdict.
  const W = 2 * half;
  const capV = W * W * surfaceY;
  const capL = capV * 1000;
  const capKg = capV * (f.density ?? 1000);
  lines.push(`tank interior ≈ ${W.toFixed(1)}×${W.toFixed(1)}×${surfaceY} m = ${capV.toFixed(2)} m³ → holds ≈ ${capL >= 100 ? capL.toFixed(0) : capL.toFixed(1)} L (≈${capKg >= 100 ? capKg.toFixed(0) : capKg.toFixed(1)} kg ${f.name})`);
  return surfaceY;
}

export interface NeoStaging { lines: string[]; focus: { x: number; z: number } }

/**
 * Stage a Neo plan visibly in the live world. Every action builds its rig:
 * pools for fluids, pre-heated bodies for melt/burn, a crusher for crush,
 * launch velocity for slide/blast, a stack for build. Multi-body plans stage
 * the whole crowd side by side. Returns narration + the point to face.
 */
export function stageNeo(world: EngineWorld, plan: NeoPlan, ax: number, az: number): NeoStaging {
  clearStage(world);
  const lines: string[] = [];

  // Planet gravity for the live rig (a Mars throw arcs like Mars).
  const pl = PLANETS[plan.planet];
  if (pl) world.env.gravity = pl.gravity;

  const spawnBody = (opts: Parameters<EngineWorld["spawn"]>[0]) => {
    const b = world.spawn(opts);
    stagedBodies.add(b.id);
    return b;
  };

  // Fluid pool from the MAIN plan (the crowd shares one tank). Throws get a
  // wide catch tank; pours get a container-scale tank.
  const mainTrueH = plan.heightM ?? 10;
  const mainH = Math.min(mainTrueH, 120);
  const mainTrueV = plan.velMs ?? 6;
  const mainStageV = Math.min(mainTrueV, 400);
  let surfaceY = 0;
  if (plan.target.kind === "fluid" && plan.target.fluid) {
    const v0 = plan.action === "throw" ? mainStageV : 0;
    const ang = plan.angleDeg ?? 25;
    const vy0 = v0 * Math.sin((ang * Math.PI) / 180);
    const vx0 = v0 * Math.cos((ang * Math.PI) / 180);
    const tF = (vy0 + Math.sqrt(vy0 * vy0 + 2 * world.env.gravity * mainH)) / world.env.gravity;
    const half = plan.action === "pour"
      ? Math.min(4, Math.max(0.3, plan.sizeM * 0.4))
      : Math.max(3, vx0 * tF * 0.6 + 3);
    surfaceY = buildTank(world, plan.target.fluid, ax, az, half, lines);
  }

  const cast = plan.condIf && plan.condThen ? [plan.condIf, plan.condThen] : [plan, ...plan.multi];
  if (plan.condIf && plan.condThen) {
    lines.push("branch: the second setup drops only if the first breaks — verdict simmed the condition first");
  }
  // Obstacle wall ("over the wall"): a static slab standing in the flight
  // lane. The verdict measures clearance; the live wall collides honestly.
  if (plan.obstacle && !(plan.condIf && plan.condThen)) {
    const half = plan.obstacle.heightM / 2;
    const wb = world.spawn({ shape: "box", material: plan.obstacle.material, sizeM: 1,
      scale: { x: 0.4, y: half, z: 2 }, pos: { x: ax + 8, y: half, z: az }, static: true });
    stagedBodies.add(wb.id);
    lines.push(`wall staged at +8 m (${plan.obstacle.heightM} m tall) — clear it or clang off it, live`);
  }
  cast.forEach((p, si) => {
    const X = ax + si * 3.5; // crowd spreads along x so every body is visible
    const pmat = MATERIALS[p.material] ?? MATERIALS.oak;
    const psize = Math.min(2, Math.max(0.2, p.sizeM));
    // Live-stage honesty: the verdict always uses the TRUE height/velocity, but
    // the visible rig stages sky-high drops at 120 m. Said out loud below.
    const ptrueH = p.heightM ?? 10;
    const pH = Math.min(ptrueH, 120);
    if (ptrueH > 120 && si === 0) lines.push(`true height ${ptrueH.toFixed(0)} m — staged at 120 m for visibility, verdict uses the full fall`);
    const ptrueV = p.velMs ?? 6;
    const tag = cast.length > 1 ? `[${si + 1}/${cast.length}] ` : "";

    switch (p.action) {
      case "throw": {
        const v0 = p.velMs ?? 6, ang = p.angleDeg ?? 25;        const vy0 = v0 * Math.sin((ang * Math.PI) / 180);
        const offV = Math.min(v0, 400); // spawn offset capped; velocity stays true
        const vx0 = v0 * Math.cos((ang * Math.PI) / 180);
        const tF = (vy0 + Math.sqrt(vy0 * vy0 + 2 * world.env.gravity * pH)) / world.env.gravity;
        const backoff = Math.min(60, (offV * Math.cos((ang * Math.PI) / 180)) * tF);
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X - backoff, y: surfaceY + pH, z: az }, vel: { x: vx0, y: vy0, z: 0 },
          dragProfile: p.shape === "sphere" ? "sphere" : "cube" });
        const vStr = v0 >= 1000000 ? `${(v0 / 1000000).toFixed(1)}M m/s` : v0 >= 10000 ? `${(v0 / 1000).toFixed(1)}k m/s` : `${+v0.toFixed(1)} m/s`;
        lines.push(`${tag}${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) thrown ${vStr} @ ${ang}° from ${ptrueH} m`);
        if (ptrueV > 400) lines.push("streaking too fast to track — watch the verdict trace for the real numbers");
        if (p.target.kind === "fluid" && (FLUIDS[p.target.fluid!]?.tempC ?? 0) >= 500) {
          lines.push(`${FLUIDS[p.target.fluid!].name} runs ~${FLUIDS[p.target.fluid!].tempC}°C — it will MELT/BURN on contact, not just splash. Watch the live log.`);
        }
        if (p.containedFluid) {
          const coreMat = MATERIALS[p.containedFluid] ? p.containedFluid : "water";
          const fill = p.fillFrac ?? 1;
          if (fill <= 0) {
            lines.push(`${tag}vessel goes up EMPTY — shell only`);
          } else {
            // Core rides smaller with headspace (fill-scaled, no z-fighting),
            // tethered live in the verdict sim (approx slosh, not CFD).
            const coreSize = psize * 0.96 * Math.cbrt(Math.min(1, fill));
            spawnBody({ shape: p.shape, material: coreMat, sizeM: Math.max(0.05, coreSize),
              pos: { x: X - backoff, y: surfaceY + pH, z: az }, vel: { x: vx0, y: vy0, z: 0 },
              dragProfile: p.shape === "sphere" ? "sphere" : "cube",
              massOverrideKg: b.massKg });
            lines.push(`${tag}${FLUIDS[p.containedFluid].name} sealed inside (${Math.round(fill * 100)}% full) — visible core flies with the shell, sloshes, splashes apart on impact`);
          }
        }
        break;
      }
      case "melt": case "burn": case "boil": {
        const demo = p.tempC ?? pmat.meltC ?? pmat.ignitionC ?? 500;
        world.env.ambientC = demo + 50; // chamber holds the heat
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: psize, z: az }, tempC: demo + 50 });
        lines.push(`${tag}heat chamber at ${demo + 50}°C — ${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) placed inside`);
        lines.push(pmat.meltC !== undefined && demo + 50 >= pmat.meltC ? "watch it MELT — glowing puddle, live" : "watch the verdict: this heat cannot melt it");
        break;
      }
      case "freeze": {
        world.env.ambientC = -30;
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: psize, z: az }, tempC: -30 });
        lines.push(`${tag}cold chamber at -30°C — ${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) placed inside`);
        lines.push("honest limit: the engine has no freeze kinetics yet — cold is staged, verdict is thermal math");
        break;
      }
      case "crush": {
        const target = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: psize, z: az } });
        const crusher = spawnBody({ shape: "box", material: "steel", sizeM: 1.5,
          pos: { x: X, y: psize * 2 + pH, z: az } });
        lines.push(`${tag}${pmat.name} ${p.shape} (${target.massKg.toFixed(0)} kg) on the ground`);
        lines.push(`steel crusher (${crusher.massKg.toFixed(0)} kg) dropped from ${ptrueH} m — impact verdict is per-body vs ground`);
        break;
      }
      case "slide": {
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X - 6, y: psize, z: az }, vel: { x: 8, y: 0, z: 0 } });
        lines.push(`${tag}${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) sliding at 8 m/s — friction bleeds it live`);
        break;
      }
      case "blast": {
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: 30, z: az }, vel: { x: 0, y: -25, z: 0 } });
        lines.push(`${tag}${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) slammed down at 25 m/s — blast impact, live`);
        break;
      }
      case "build": {
        for (let i = 0; i < 3; i++) {
          spawnBody({ shape: "box", material: p.material, sizeM: psize,
            pos: { x: X, y: psize + i * psize * 2, z: az } });
        }
        lines.push(`${tag}Neo stacked 3 × ${pmat.name} blocks (${psize} m) — a wall, built live`);
        break;
      }
      case "scratch": {
        const tool = spawnBody({ shape: "box", material: p.material, sizeM: psize,
          pos: { x: X - psize * 1.5, y: psize, z: az } });
        spawnBody({ shape: "box", material: "glass", sizeM: psize, pos: { x: X + psize * 1.5, y: psize, z: az } });
        const tMohs = pmat.mohs, gMohs = MATERIALS.glass.mohs!;
        lines.push(`${tag}${pmat.name} tool (Mohs ${tMohs ?? "?"}) vs glass block (Mohs ${gMohs})`);
        lines.push(tMohs !== undefined && tMohs >= gMohs ? "tool wins — it scratches the glass (verdict has the math)" : "tool loses — glass wins (verdict has the math)");
        void tool;
        break;
      }
      case "pour": {
        const f = FLUIDS[p.pourFluid ?? "water"] ?? FLUIDS.water;
        lines.push(`${tag}${f.name} poured live — pool is real fluid (buoyancy + viscosity on)`);
        if (p.reportCapacity) {
          const V = p.shape === "sphere" ? (4 / 3) * Math.PI * (psize / 2) ** 3 : psize ** 3;
          const L = V * 1000;
          const kg = V * (f.density ?? 1000);
          lines.push(`container: ${psize} m ${p.shape} → interior ${V.toFixed(V < 0.01 ? 4 : 3)} m³ ≈ ${L >= 100 ? L.toFixed(0) : L.toFixed(1)} L of ${f.name} (≈${kg >= 100 ? kg.toFixed(0) : kg.toFixed(1)} kg)`);
        } else if (si === 0) {
          lines.push("drop something in: type it in the Neo bar, e.g. “sink lead in water”");
        }
        break;
      }
      case "electrify": {
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: psize, z: az } });
        lines.push(`${tag}${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) wired into the spark gap`);
        lines.push("throw the switch in the verdict below — conductivity vs breakdown, live numbers");
        break;
      }
      case "dissolve": {
        const acidId = p.acid && ACIDS[p.acid] ? p.acid : "batteryAcid";
        const acidName = ACIDS[acidId].name;
        // Real vat: true fluid pool (splash + float/sink live); the corrosion
        // timeline itself stays a table verdict (no corrosion kinetics in-engine).
        // One vat per staging — the crowd shares it.
        if (stagedFluidCount === 0) {
          const ACID_RHO: Record<string, number> = {
            batteryAcid: 1840, drainCleaner: 1300, bleach: 1100, gastricAcid: 1010, pureWater: 1000,
          };
          const rho = ACID_RHO[acidId] ?? 1000;
          stagedFluidStart = world.fluids.length;
          world.addFluid({ name: `${acidName} (acid)`, min: { x: ax - 3, y: 0, z: az - 3 },
            max: { x: ax + 3, y: 1.7, z: az + 3 }, density: rho, viscosity: 0.002 });
          stagedFluidCount = 1;
          const t = 0.09, wall = (sx: number, sz: number, px: number, pz: number) => {
            const wb = world.spawn({ shape: "box", material: "glass", sizeM: 1, static: true,
              scale: { x: sx, y: 1.1, z: sz }, pos: { x: px, y: 1.1, z: pz } });
            stagedBodies.add(wb.id);
          };
          wall(3 + t, t, ax, az - 3 - t); wall(3 + t, t, ax, az + 3 + t);
          wall(t, 3 + t, ax - 3 - t, az); wall(t, 3 + t, ax + 3 + t, az);
          lines.push(`acid vat built — ${acidName} pool is real fluid`);
        }
        const rho = acidId === "batteryAcid" ? 1840 : acidId === "drainCleaner" ? 1300 : acidId === "bleach" ? 1100 : 1010;
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: 1.7 + (p.heightM ?? 6), z: az } });
        lines.push(`${tag}${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) dropped in — splash → ${pmat.density < rho ? "float" : "sink"} now, corrosion timeline in the verdict`);
        break;
      }
      case "lase": {
        spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: psize, z: az } });
        lines.push(`${tag}${pmat.name} ${p.shape} on the optical bench — beam path staged`);
        lines.push("Snell bend angle is in the verdict — glass bends, diamond traps light");
        break;
      }
      case "roll": {
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X - 6, y: psize, z: az }, vel: { x: 10, y: 0, z: 0 } });
        lines.push(`${tag}${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) rolling at 10 m/s — resistance bleeds it live`);
        break;
      }
      default: { // drop / float / sink
        const b = spawnBody({ shape: p.shape, material: p.material, sizeM: psize,
          pos: { x: X, y: surfaceY + pH, z: az } });
        lines.push(`${tag}${pmat.name} ${p.shape} (${b.massKg.toFixed(0)} kg) released from ${ptrueH} m`);
        if (p.spin && (p.spin[0] || p.spin[1] || p.spin[2])) {
          lines.push(`${tag}spinning [${p.spin.join(", ")}] rad/s — Magnus curve live (bodies lift, they don't tumble)`);
        }
        if (p.containedFluid) {
          const coreMat = MATERIALS[p.containedFluid] ? p.containedFluid : "water";
          const fill = p.fillFrac ?? 1;
          if (fill <= 0) {
            lines.push(`${tag}vessel falls EMPTY — shell only`);
          } else {
            spawnBody({ shape: p.shape, material: coreMat, sizeM: Math.max(0.05, psize * 0.96 * Math.cbrt(Math.min(1, fill))),
              pos: { x: X, y: surfaceY + pH, z: az }, massOverrideKg: b.massKg });
            lines.push(`${tag}${FLUIDS[p.containedFluid].name} sealed inside (${Math.round(fill * 100)}% full) — visible core rides along, sloshes, splashes apart on impact`);
          }
        }
        if (p.target.kind === "fluid" && p.target.fluid) {
          const f = FLUIDS[p.target.fluid];
          lines.push(`watch: splash → ${pmat.density < (f.density ?? 1e9) ? "float" : "sink"}`);
          if ((f.tempC ?? 0) >= 500) lines.push(`${f.name} runs ~${f.tempC}°C — it will MELT/BURN in there. Watch the live log.`);
        } else {
          lines.push("watch it fall — impact vs strength, live");
        }
      }
    }
  });
  return { lines, focus: { x: ax, z: az } };
}
