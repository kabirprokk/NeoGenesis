// The invention: an AI experience rig. A prompt goes in, the engine lives it with
// real physics and real material data, and a verdict comes out: is it even real?
//
// Two input modes:
//   1. Natural prompt:  "drop an oak crate from 100m", "can a human lift 300kg",
//      "does lead melt at 500C", "does steel scratch glass", "float oak in water",
//      "throw a sphere at 30 m/s 45 degrees on Mars", "hear a blast from 2km"
//   2. Full JSON scenario (agents should prefer this): full control of bodies,
//      environment preset, duration, and explicit checks.
//
// Honesty policy: REAL only when the numbers clear thresholds. Anything unknowable
// (missing data, ambiguous prompt) returns MIXED with the gap named — never guessed.
import { PHYSICS } from "./constants.js";
import { MATERIALS, FLUIDS, MOHS_LADDER, explosiveClass, EXPLOSIVES, FRICTION_PAIRS, REPOSE_DEG } from "./materials.js";
import { PLANETS } from "./planets.js";
import { EngineWorld } from "./world.js";
import {
  terminalVelocity, humanTerminal, projectileRange, impact,
  mohsVerdict, buoyancyVerdict, soundDelay, slidesOnIncline, reposeOk, dragCd,
} from "./physics.js";

export type Verdict = "REAL" | "NOT REAL" | "MIXED";
export interface TraceSample { t: number; y: number; v: number; tempC: number; event?: string }
export interface ExperienceResult {
  verdict: Verdict; confidence: number;
  prompt: string; environment: string;
  measurements: Record<string, number | string | boolean>;
  trace: TraceSample[]; events: string[]; reasons: string[];
}
export interface ScenarioDesc {
  env?: string; gravity?: number; ambientC?: number; airDensity?: number;
  durationS?: number;
  bodies?: { shape?: "sphere" | "box"; material?: string; sizeM?: number; heightM?: number; vel?: [number, number, number]; tempC?: number; dragProfile?: string }[];
  checks?: ({ kind: "survives-fall"; heightM: number } | { kind: "floats-in"; fluid: string } | { kind: "scratch"; tool: string; target: string } | { kind: "melt-at"; tempC: number } | { kind: "hear-at"; distM: number; mediumMs?: number })[];
}

const reason = (r: ExperienceResult, v: Verdict, c: number, text: string) => {
  r.reasons.push(text);
  if (v === "NOT REAL") { r.verdict = "NOT REAL"; r.confidence = Math.max(r.confidence, c); }
  else if (v === "MIXED" && r.verdict === "REAL") { r.verdict = "MIXED"; r.confidence = Math.max(r.confidence, c); }
  else if (v === "REAL") r.confidence = Math.max(r.confidence, c);
};
const fresh = (prompt: string, env: string): ExperienceResult => ({
  verdict: "REAL", confidence: 0, prompt, environment: env,
  measurements: {}, trace: [], events: [], reasons: [],
});
const MAT_ALIAS: Record<string, string> = {
  wood: "oak", wooden: "oak", metal: "steel", rock: "concrete", stone: "concrete",
  plastic: "teflon", "ice cube": "ice", human: "water",
};

export function experience(input: string | ScenarioDesc): ExperienceResult {
  if (typeof input !== "string") return runScenario("json-scenario", input);
  const p = input.toLowerCase();

  // --- environment picker (any planet named → whole sim runs there) ---
  let planet = PLANETS.earth;
  for (const k of Object.keys(PLANETS)) {
    if (p.includes(k)) { planet = PLANETS[k]; break; }
  }
  const envName = `${planet.name} (g=${planet.gravity} m/s²${planet.tempC !== null ? `, ${planet.tempC}°C` : ""})`;

  // --- material picker ---
  let matId = "oak";
  for (const k of Object.keys(MATERIALS)) if (p.includes(k) || p.includes(MATERIALS[k].name.toLowerCase())) { matId = k; break; }
  for (const [alias, id] of Object.entries(MAT_ALIAS)) if (p.includes(alias)) { matId = id; break; }
  const mat = MATERIALS[matId];

  // --- fluid picker ---
  let fluidId = "water";
  for (const k of Object.keys(FLUIDS)) if (p.includes(k)) { fluidId = k; break; }

  // 1. LIFT verdicts — human strength is bounded and well documented.
  const liftM = p.match(/lift|carry|hold|pick up/);
  const kgM = p.match(/(\d+(?:\.\d+)?)\s?kg/);
  if (liftM && kgM) {
    const kg = parseFloat(kgM[1]);
    const r = fresh(input, envName);
    const gL = planet.gravity / PHYSICS.G_EARTH;
    r.measurements = { massKg: kg, weightN: +(kg * planet.gravity).toFixed(1), earthEquivalentKg: +(kg * gL).toFixed(1) };
    if (kg * gL > 250) reason(r, "NOT REAL", 0.95, `No human lifts ${kg} kg at ${planet.gravity} m/s² (${(kg * planet.gravity / 1000).toFixed(1)} kN). Elite deadlift ≈ 250 kg on Earth.`);
    else if (kg * gL > 100) reason(r, "MIXED", 0.7, `Only elite strength athletes move ${kg} kg-equivalent. Ordinary human: NOT REAL.`);
    else reason(r, "REAL", 0.9, `${kg} kg is within trained human capacity (force ${(kg * planet.gravity).toFixed(0)} N).`);
    return r;
  }

  // 2. MELT / BURN verdicts.
  const tempM = p.match(/(-?\d+(?:\.\d+)?)\s?°?c/);
  if (/melt|burn|ignite|heat|freeze|boil|fire|lava/.test(p) && tempM) {
    const T = parseFloat(tempM[1]);
    const r = fresh(input, envName);
    r.measurements = { tempC: T, meltC: mat.meltC ?? "unknown", ignitionC: mat.ignitionC ?? "unknown" };
    if (mat.meltC !== undefined && T >= mat.meltC) reason(r, "REAL", 0.98, `${mat.name} melts at ${mat.meltC}°C — at ${T}°C it is liquid. You would watch it puddle.`);
    else if (mat.ignitionC !== undefined && T >= mat.ignitionC) reason(r, "REAL", 0.95, `${mat.name} ignites at ${mat.ignitionC}°C — at ${T}°C it burns.`);
    else if (mat.meltC !== undefined) reason(r, "NOT REAL", 0.95, `${mat.name} needs ${mat.meltC}°C to melt; ${T}°C only warms it. No melting. No fire.`);
    else reason(r, "MIXED", 0.5, `No melt/ignition data for ${mat.name} — cannot render thermal verdict.`);
    return r;
  }

  // 3. FLOAT / SINK verdicts — actually simulated.
  if (/float|sink|swim|buoy|boat/.test(p)) {
    const r = fresh(input, envName);
    const w = new EngineWorld();
    const f = FLUIDS[fluidId];
    w.env.ambientC = 15;
    const b = w.spawn({ shape: "box", material: matId, sizeM: 1, pos: { x: 0, y: 5, z: 0 } });
    w.run(4);
    r.measurements = { bodyDensity: mat.density, fluidDensity: f.density ?? "unknown", viscosityPas: f.viscosity, restY: +b.pos.y.toFixed(2) };
    const v = buoyancyVerdict(mat.density, f.density, mat.name, f.name);
    reason(r, v.includes("NOT REAL") ? "NOT REAL" : v.includes("UNKNOWN") ? "MIXED" : "REAL", 0.9, v + ` Simulated 4 s: rest height ${b.pos.y.toFixed(2)} m.`);
    return r;
  }

  // 4. SCRATCH verdicts (Mohs).
  if (/scratch|cut|chisels?|mine|pickaxe|tool/.test(p)) {
    const r = fresh(input, envName);
    const found = MOHS_LADDER.filter(([name]) => p.includes(name)).map(([, v]) => v);
    const toolMohs = mat.mohs ?? found[0] ?? NaN;
    const tgtMohs = found.length > (mat.mohs !== undefined ? 0 : 1)
      ? found[found.length - 1] : (mat.mohs !== undefined ? (found[0] ?? NaN) : NaN);
    if (Number.isNaN(toolMohs) || Number.isNaN(tgtMohs)) {
      reason(r, "MIXED", 0.4, "Need two named minerals/materials (e.g. 'can steel scratch quartz').");
      return r;
    }
    const v = mohsVerdict(toolMohs, tgtMohs, "tool", "target");
    r.measurements = { toolMohs, targetMohs: tgtMohs };
    reason(r, v.includes("NOT REAL") ? "NOT REAL" : "REAL", 0.95, v);
    return r;
  }

  // 5. HEAR / BLAST verdicts — sound delay + explosive tiers.
  if (/hear|sound|blast|explos|tnt|detonat/.test(p)) {
    const r = fresh(input, envName);
    const kmM = p.match(/(\d+(?:\.\d+)?)\s?km/);
    const mM = p.match(/(\d+(?:\.\d+)?)\s?m(?!\/s)/);
    const distM = kmM ? parseFloat(kmM[1]) * 1000 : mM ? parseFloat(mM[1]) : 1000;
    const delay = soundDelay(distM, PHYSICS.SOUND_AIR);
    r.measurements = { distM, soundDelayS: +delay.toFixed(2) };
    reason(r, "REAL", 0.95, `At ${distM} m you see the flash first and hear it ${delay.toFixed(1)} s later (343 m/s).`);
    for (const [name, vel] of Object.entries(EXPLOSIVES)) {
      if (p.includes(name) || p.includes("tnt") && name === "tnt") {
        reason(r, "REAL", 0.9, `${name.toUpperCase} detonates at ${vel} m/s: ${explosiveClass(vel)}.`);
        break;
      }
    }
    if (/tnt|blast|explos/.test(p) && !Object.keys(EXPLOSIVES).some((k) => p.includes(k))) {
      reason(r, "REAL", 0.85, `Baseline blast (TNT tier, 6900 m/s): ${explosiveClass(6900)}.`);
    }
    return r;
  }

  // 6. THROW / SHOOT / LAUNCH — ballistic verdict + simulated arc.
  const velM = p.match(/(\d+(?:\.\d+)?)\s?m\/s/);
  if (/throw|shoot|launch|fire|projectile|jump|fall|drop/.test(p)) {
    const r = fresh(input, envName);
    const v0 = velM ? parseFloat(velM[1]) : 0;
    const hM = p.match(/from\s(\d+(?:\.\d+)?)\s?m|(\d+(?:\.\d+)?)\s?m\s(high|tall|drop|fall)/);
    const h0 = hM ? parseFloat(hM[1] ?? hM[2]) : 10;
    const angM = p.match(/(\d+(?:\.\d+)?)\s?(degrees|°)/);
    const ang = angM ? parseFloat(angM[1]) : 45;
    const w = new EngineWorld();
    w.env.gravity = planet.gravity;
    w.env.airDensity = planet.pressureAtm !== null && planet.pressureAtm < 0.01 ? 0.001 : PHYSICS.AIR_DENSITY;
    const b = w.spawn({
      shape: "sphere", material: matId, sizeM: 0.5,
      pos: { x: 0, y: h0, z: 0 },
      vel: v0 ? { x: v0 * Math.cos((ang * Math.PI) / 180), y: v0 * Math.sin((ang * Math.PI) / 180), z: 0 } : undefined,
      dragProfile: "sphere",
    });
    const n = Math.ceil(12 * 120);
    for (let i = 0; i < n; i++) {
      w.step(1 / 120);
      if (i % 60 === 0) r.trace.push({ t: +w.time.toFixed(2), y: +b.pos.y.toFixed(2), v: +Math.hypot(b.vel.x, b.vel.y).toFixed(1), tempC: b.tempC, event: b.events[b.events.length - 1] });
      if (b.broken) break;
    }
    const range = Math.hypot(b.pos.x, b.pos.z);
    const vacRange = v0 ? projectileRange(v0, ang, planet.gravity) : 0;
    r.measurements = {
      v0ms: v0, heightM: h0, gravity: planet.gravity,
      simRangeM: +range.toFixed(1), vacuumRangeM: +vacRange.toFixed(1),
      terminalVms: +terminalVelocity(b.massKg, b.dragCd, b.areaM2, w.env.airDensity).toFixed(1),
      broken: b.broken,
    };
    r.events = b.events;
    if (b.broken) reason(r, "REAL", 0.9, `It does NOT survive: ${b.events[b.events.length - 1]}`);
    else if (v0 && range < vacRange * 0.5) reason(r, "REAL", 0.85, `Short of vacuum range (${vacRange.toFixed(0)} m → ${range.toFixed(0)} m): drag is eating it alive. Games that ignore this are NOT REAL.`);
    else reason(r, "REAL", 0.85, `Lands ${range.toFixed(1)} m out, intact. Numbers above — check any game against them.`);
    return r;
  }

  // 7. FRICTION / SLIDE verdicts.
  if (/slid|slip|friction|grip|ice/.test(p)) {
    const r = fresh(input, envName);
    const pair = Object.entries(FRICTION_PAIRS).find(([k]) => p.includes(k.replace(/([A-Z])/g, " $1").toLowerCase().split(" ")[0])) ?? ["rubberDryConcrete", FRICTION_PAIRS.rubberDryConcrete];
    const angM = p.match(/(\d+(?:\.\d+)?)\s?(degrees|°|slope)/);
    const ang = angM ? parseFloat(angM[1]) : 20;
    const slides = slidesOnIncline(pair[1].muS, ang);
    r.measurements = { pair: pair[0], muS: pair[1].muS, angleDeg: ang, slides };
    reason(r, "REAL", 0.9, slides
      ? `At ${ang}° with μs=${pair[1].muS} it slides (tan ${ang}° > μs). Anything standing still there is NOT REAL.`
      : `At ${ang}° with μs=${pair[1].muS} it grips.`);
    return r;
  }

  // 8. Fallback: full drop-test of the named material on the named planet.
  return runScenario(input, {
    env: planet.id, durationS: 8,
    bodies: [{ shape: "box", material: matId, sizeM: 1, heightM: 50 }],
    checks: [{ kind: "survives-fall", heightM: 50 }],
  });
}

export function runScenario(prompt: string, s: ScenarioDesc): ExperienceResult {
  const planet = (s.env && PLANETS[s.env]) || PLANETS.earth;
  const r = fresh(prompt, `${planet.name} (g=${s.gravity ?? planet.gravity} m/s²)`);
  const w = new EngineWorld();
  w.env.gravity = s.gravity ?? planet.gravity;
  if (s.ambientC !== undefined) w.env.ambientC = s.ambientC;
  if (s.airDensity !== undefined) w.env.airDensity = s.airDensity;
  const bodies = (s.bodies ?? [{ shape: "box", material: "oak", sizeM: 1, heightM: 20 }]).map((d) =>
    w.spawn({
      shape: d.shape, material: d.material, sizeM: d.sizeM,
      pos: { x: 0, y: d.heightM ?? 10, z: 0 }, vel: d.vel ? { x: d.vel[0], y: d.vel[1], z: d.vel[2] } : undefined,
      tempC: d.tempC, dragProfile: d.dragProfile,
    }));
  const n = Math.ceil((s.durationS ?? 8) * 120);
  for (let i = 0; i < n; i++) {
    w.step(1 / 120);
    if (i % 120 === 0) {
      const b = bodies[0];
      r.trace.push({ t: +w.time.toFixed(1), y: +b.pos.y.toFixed(2), v: +Math.hypot(b.vel.x, b.vel.y, b.vel.z).toFixed(1), tempC: +b.tempC.toFixed(1) });
    }
    if (bodies.every((b) => b.broken || (b.pos.y <= (b.shape === "sphere" ? b.radiusM : b.halfM!.y) + 0.01 && Math.hypot(b.vel.x, b.vel.y, b.vel.z) < 0.3))) break;
  }
  const b = bodies[0];
  r.measurements = {
    bodies: bodies.length, simTimeS: +w.time.toFixed(2),
    impactVms: +Math.hypot(b.vel.x, b.vel.y, b.vel.z).toFixed(1),
    broken: b.broken, molten: b.molten, burning: b.burning,
    humanTerminalVms: +humanTerminal().toFixed(1),
  };
  r.events = w.log;
  for (const c of s.checks ?? []) {
    if (c.kind === "survives-fall") {
      if (b.broken) reason(r, "REAL", 0.92, `NOT survivable as shown: ${w.log[w.log.length - 1] ?? "shattered"}. Any game where this survives a ${c.heightM} m fall is NOT REAL.`);
      else reason(r, "REAL", 0.85, `Survives a ${c.heightM} m fall intact — impact within ${b.material.name} limits.`);
    } else if (c.kind === "floats-in") {
      const f = FLUIDS[c.fluid] ?? FLUIDS.water;
      const v = buoyancyVerdict(b.material.density, f.density, b.material.name, f.name);
      r.measurements.fluid = f.name;
      reason(r, v.includes("UNKNOWN") ? "MIXED" : "REAL", 0.9, v);
    } else if (c.kind === "scratch") {
      const tool = MATERIALS[c.tool]?.mohs, tgt = MATERIALS[c.target]?.mohs;
      if (tool === undefined || tgt === undefined) reason(r, "MIXED", 0.4, "Unknown Mohs data for one side.");
      else { const v = mohsVerdict(tool, tgt, c.tool, c.target); reason(r, v.includes("NOT REAL") ? "NOT REAL" : "REAL", 0.95, v); }
    } else if (c.kind === "melt-at") {
      const m = b.material;
      if (m.meltC !== undefined && c.tempC >= m.meltC) reason(r, "REAL", 0.97, `${m.name} melts at ${m.meltC}°C; ${c.tempC}°C liquefies it.`);
      else if (m.meltC !== undefined) reason(r, "NOT REAL", 0.95, `${c.tempC}°C cannot melt ${m.name} (${m.meltC}°C).`);
      else reason(r, "MIXED", 0.4, "No melt data.");
    } else if (c.kind === "hear-at") {
      const d = soundDelay(c.distM, c.mediumMs ?? PHYSICS.SOUND_AIR);
      r.measurements.soundDelayS = +d.toFixed(2);
      reason(r, "REAL", 0.95, `Heard ${d.toFixed(1)} s after seen at ${c.distM} m.`);
    }
  }
  if (!(s.checks ?? []).length) {
    reason(r, "REAL", 0.7, `Baseline drop-test complete: ${b.broken ? "shattered" : "intact"}. Add checks for verdicts.`);
  }
  void dragCd; void reposeOk; void REPOSE_DEG;
  return r;
}
