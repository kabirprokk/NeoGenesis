// Tool registry — every capability the engine offers an AI agent, as callable tools
// with JSON schemas (OpenAI-function style). 35 tools across data, physics,
// simulation, models, and experience. Headless via CLI: npm run experience -- --tool <name> '<json>'.
import { PHYSICS } from "./constants.js";
import { MATERIALS, FLUIDS, DRAG_CD, MOHS_LADDER, EXPLOSIVES, explosiveClass, FRICTION_PAIRS, REPOSE_DEG, STARS, GASES } from "./materials.js";
import { PLANETS } from "./planets.js";
import { EngineWorld } from "./world.js";
import { getModel, spawnModel, MODEL_COUNT, MODEL_CLASSES } from "./models.js";
import { experience, runScenario, verdictCSV } from "./experience.js";
import { neoParse, neoScenario, neoSamples, neoPatternCount, neoToolFor } from "./neo.js";
import { terminalVelocity, projectileRange, impact, buoyancyVerdict, soundDelay, slidesOnIncline, reposeOk, heatEnergyJ, heatTimeS, lorentz, relKineticJ, orbitVelocity, escapeVelocity, orbitPeriodS, horizonM, soundSpeed, gravityAt, blackbodyFlux } from "./physics.js";
import { SPECIFIC_HEAT, UNCERTAINTY, H_CONV, CITATIONS, EMISSIVITY } from "./science.js";
import { CODEX_VERSION } from "./constants.js";

export type Args = Record<string, string | number | boolean>;
export interface ToolCtx { world?: EngineWorld }
export interface ToolDef {
  name: string; description: string;
  schema: { type: "object"; properties: Record<string, { type: string; description: string }>; required: string[] };
  run: (a: Args, ctx: ToolCtx) => unknown;
}
const num = (a: Args, k: string, d = 0): number => (typeof a[k] === "number" ? a[k] : d);
const str = (a: Args, k: string, d = ""): string => String(a[k] ?? d);
const T = (required: string[], props: [string, string, string][]): ToolDef["schema"] => ({
  type: "object", required,
  properties: Object.fromEntries(props.map(([k, t, d]) => [k, { type: t, description: d }])),
});
const def = (name: string, description: string, schema: ToolDef["schema"], run: ToolDef["run"]): ToolDef =>
  ({ name, description, schema, run });
const W = (ctx: ToolCtx): EngineWorld => (ctx.world ??= new EngineWorld());

export const TOOLS: ToolDef[] = [
  // ---- data ----
  def("material-get", "Full property record for one material.", T(["id"], [["id", "string", "material id, e.g. steel"]]),
    (a) => MATERIALS[str(a, "id")] ?? { error: "unknown material" }),
  def("material-list", "All material ids + densities.", T([], []), () =>
    Object.values(MATERIALS).map((m) => ({ id: m.id, density: m.density }))),
  def("fluid-get", "Viscosity (+density where known) for one fluid.", T(["id"], [["id", "string", "fluid id"]]),
    (a) => FLUIDS[str(a, "id")] ?? { error: "unknown fluid" }),
  def("fluid-list", "All fluids with viscosity.", T([], []), () =>
    Object.values(FLUIDS).map((f) => ({ id: f.id, viscosityPas: f.viscosity }))),
  def("planet-get", "Gravity/pressure/temperature/hazards for one body.", T(["id"], [["id", "string", "e.g. mars"]]),
    (a) => PLANETS[str(a, "id")] ?? { error: "unknown planet" }),
  def("planet-list", "All 12 bodies with gravity.", T([], []), () =>
    Object.values(PLANETS).map((p) => ({ id: p.id, gravity: p.gravity }))),
  def("mohs-ladder", "The 1–10 hardness ladder.", T([], []), () => MOHS_LADDER),
  def("drag-table", "Drag coefficients by profile.", T([], []), () => DRAG_CD),
  def("friction-pairs", "Named static/kinetic friction pairs.", T([], []), () => FRICTION_PAIRS),
  def("repose-table", "Angle-of-repose ranges for granular states.", T([], []), () => REPOSE_DEG),
  def("explosives", "Detonation velocities + tier of each.", T([], []),
    () => Object.fromEntries(Object.entries(EXPLOSIVES).map(([k, v]) => [k, { velMs: v, tier: explosiveClass(v) }]))),
  def("gases", "Gas constants, densities, hazard behavior.", T([], []), () => GASES),
  def("stars", "Stellar classes + radiation multipliers.", T([], []), () => STARS),
  def("constants", "Fundamental constants (g, c, G, atm…).", T([], []), () => PHYSICS),
  // ---- models ----
  def("model-count", "Registry size (12,000).", T([], []), () => ({ count: MODEL_COUNT })),
  def("model-get", "Deterministic registry entry by index.", T(["index"], [["index", "number", "0–11999"]]),
    (a) => getModel(num(a, "index"))),
  def("model-search", "First N entries matching material and/or class.", T([], [["material", "string", "optional"], ["class", "string", "optional"], ["limit", "number", "default 10"]]),
    (a) => {
      const out = [];
      for (let i = 0; i < MODEL_COUNT && out.length < (num(a, "limit", 10) || 10); i++) {
        const m = getModel(i);
        if (str(a, "material") && m.material !== str(a, "material")) continue;
        if (str(a, "class") && m.class !== str(a, "class")) continue;
        out.push(m);
      }
      return out;
    }),
  def("model-classes", "The 12 model classes.", T([], []), () => MODEL_CLASSES),
  // ---- physics (stateless) ----
  def("terminal-velocity", "Terminal velocity for mass/Cd/area/fluid.", T(["massKg", "cd", "areaM2"], [["massKg", "number", "kg"], ["cd", "number", "drag coefficient"], ["areaM2", "number", "m²"], ["fluid", "string", "air|water|… default air"]]),
    (a) => ({ vtMs: terminalVelocity(num(a, "massKg"), num(a, "cd"), num(a, "areaM2"), FLUIDS[str(a, "fluid", "air")]?.density ?? 1.225) })),
  def("projectile-range", "Vacuum range for velocity/angle/gravity.", T(["vMs", "angleDeg"], [["vMs", "number", "m/s"], ["angleDeg", "number", "degrees"], ["g", "number", "default 9.80665"]]),
    (a) => ({ rangeM: projectileRange(num(a, "vMs"), num(a, "angleDeg"), num(a, "g", PHYSICS.G_EARTH)) })),
  def("impact", "KE + pressure over contact area.", T(["massKg", "vMs", "areaM2"], [["massKg", "number", "kg"], ["vMs", "number", "m/s"], ["areaM2", "number", "m²"]]),
    (a) => impact(num(a, "massKg"), num(a, "vMs"), num(a, "areaM2"))),
  def("buoyancy", "Float/sink verdict for body vs fluid density.", T(["bodyDensity", "fluid"], [["bodyDensity", "number", "kg/m³"], ["fluid", "string", "fluid id"]]),
    (a) => ({ verdict: buoyancyVerdict(num(a, "bodyDensity"), FLUIDS[str(a, "fluid")]?.density, "body", str(a, "fluid")) })),
  def("sound-delay", "Seconds until heard at distance.", T(["distM"], [["distM", "number", "meters"], ["mediumMs", "number", "default 343"]]),
    (a) => ({ seconds: soundDelay(num(a, "distM"), num(a, "mediumMs", 343)) })),
  def("slide-check", "Whether μs holds on an incline.", T(["muS", "angleDeg"], [["muS", "number", "static friction"], ["angleDeg", "number", "degrees"]]),
    (a) => ({ slides: slidesOnIncline(num(a, "muS"), num(a, "angleDeg")) })),
  def("repose-check", "Granular stability verdict.", T(["material", "angleDeg"], [["material", "string", "drySand|soil|gravel|…"], ["angleDeg", "number", "degrees"]]),
    (a) => ({ verdict: reposeOk(REPOSE_DEG[str(a, "material")] ?? [30, 35], num(a, "angleDeg")) })),
  def("explosive-class", "Blast tier for a detonation velocity.", T(["velMs"], [["velMs", "number", "m/s"]]),
    (a) => ({ tier: explosiveClass(num(a, "velMs")) })),
  def("heat-energy", "Sensible + fusion energy (kJ) to heat/melt a mass of material.", T(["material", "massKg", "fromC", "toC"], [["material", "string", "material id"], ["massKg", "number", "kg"], ["fromC", "number", "start °C"], ["toC", "number", "target °C"]]),
    (a) => {
      const th = SPECIFIC_HEAT[str(a, "material")];
      if (!th) return { error: "unknown thermal data" };
      const m = num(a, "massKg", 1);
      const sensibleKJ = heatEnergyJ(m, th.c, num(a, "toC") - num(a, "fromC")) / 1000;
      const mat = MATERIALS[str(a, "material")];
      const melts = mat?.meltC !== undefined && num(a, "toC") >= mat.meltC && num(a, "fromC") < mat.meltC;
      const fusionKJ = melts && th.lf ? m * th.lf : 0;
      return { material: th.name, specificHeatJkgK: th.c, sensibleKJ: +sensibleKJ.toFixed(1), fusionKJ: +fusionKJ.toFixed(1), totalKJ: +(sensibleKJ + fusionKJ).toFixed(1), melts };
    }),
  def("thermal-table", "Specific heat + fusion data for all materials.", T([], []),
    () => Object.values(SPECIFIC_HEAT).map((t) => ({ id: t.id, cJkgK: t.c, fusionKJkg: t.lf ?? null }))),
  def("heat-time", "Lumped-capacitance heating time (s) in a convection bath. h dominates: ±50%.", T(["massKg", "material", "areaM2", "h", "tInfC", "t0C", "t1C"], [["massKg", "number", "kg"], ["material", "string", "for specific heat"], ["areaM2", "number", "surface m²"], ["h", "number", "W/m²·K (stillAir 10, furnace 150)"], ["tInfC", "number", "bath °C"], ["t0C", "number", "start °C"], ["t1C", "number", "target °C (< bath)"]]),
    (a) => {
      const th = SPECIFIC_HEAT[str(a, "material")];
      if (!th) return { error: "unknown thermal data" };
      const t = heatTimeS(num(a, "massKg", 1), th.c, num(a, "areaM2", 1), num(a, "h", 10), num(a, "tInfC"), num(a, "t0C", 20), num(a, "t1C"));
      return Number.isFinite(t) ? { seconds: +t.toFixed(0), uncertainty: "±50% (h dominates)", model: "lumped capacitance — uniform body temperature assumed" } : { error: "target must be below bath temperature" };
    }),
  def("relativity", "Lorentz factor + relativistic vs Newtonian KE at velocity.", T(["vMs", "massKg"], [["vMs", "number", "m/s"], ["massKg", "number", "default 1"]]),
    (a) => {
      const v = num(a, "vMs"), m = num(a, "massKg", 1);
      const g = lorentz(v);
      return { gamma: +g.toFixed(6), fractionOfC: +(v / PHYSICS.C).toFixed(4), newtonianKJ: +(0.5 * m * v * v / 1000).toFixed(1), relativisticKJ: +(relKineticJ(m, v) / 1000).toFixed(1) };
    }),
  def("orbit-velocity", "Circular orbit velocity + period at altitude over a body.", T(["planet", "altitudeM"], [["planet", "string", "body id"], ["altitudeM", "number", "default 400000"]]),
    (a) => {
      const p = PLANETS[str(a, "planet", "earth")];
      if (!p?.mu || !p?.radiusM) return { error: "unknown body" };
      const alt = num(a, "altitudeM", 400000);
      return { planet: p.name, altitudeM: alt, velocityMs: +orbitVelocity(p.mu, p.radiusM, alt).toFixed(0), periodMin: +(orbitPeriodS(p.mu, p.radiusM, alt) / 60).toFixed(1) };
    }),
  def("escape-velocity", "Escape velocity from a body surface.", T(["planet"], [["planet", "string", "body id"]]),
    (a) => {
      const p = PLANETS[str(a, "planet", "earth")];
      if (!p?.mu || !p?.radiusM) return { error: "unknown body" };
      return { planet: p.name, escapeMs: +escapeVelocity(p.mu, p.radiusM).toFixed(0) };
    }),
  def("horizon", "Distance to the horizon from eye height (spherical Earth default).", T(["eyeM"], [["eyeM", "number", "eye height m"], ["radiusM", "number", "default 6371000"]]),
    (a) => ({ horizonM: +horizonM(num(a, "eyeM", 1.7), num(a, "radiusM", 6371000)).toFixed(0) })),
  def("citations", "BibTeX references for the data families behind a verdict.", T([], [["ids", "string", "comma list of cite ids, default all"]]),
    (a) => {
      const want = str(a, "ids") ? str(a, "ids").split(",").map((s) => s.trim()) : Object.keys(CITATIONS);
      return want.filter((id) => CITATIONS[id]).map((id) => {
        const c = CITATIONS[id];
        return `@misc{neogenesis_${c.id},\n  title = {${c.title}},\n  publisher = {${c.publisher}},\n  year = {${c.year}},\n  note = {NeoGenesis codex family: ${c.family}. ${c.note}}\n}`;
      });
    }),
  def("uncertainty-table", "Error bars carried by every verdict number.", T([], []), () => UNCERTAINTY),
  def("csv", "Time-series trace CSV for a prompt (all bodies). Paste into a spreadsheet.", T(["prompt"], [["prompt", "string", "natural-language experiment"]]),
    (a) => ({ csv: verdictCSV(experience(str(a, "prompt"))) })),
  def("sound-speed", "Speed of sound in dry air at a temperature.", T(["tempC"], [["tempC", "number", "°C"]]),
    (a) => ({ soundMs: +soundSpeed(num(a, "tempC", 20)).toFixed(1) })),
  def("gravity-at", "Surface gravity weakened by altitude over a body.", T(["planet", "altitudeM"], [["planet", "string", "body id"], ["altitudeM", "number", "m"]]),
    (a) => {
      const p = PLANETS[str(a, "planet", "earth")];
      if (!p?.radiusM) return { error: "unknown body" };
      return { planet: p.name, gravity: +gravityAt(p.gravity, p.radiusM, num(a, "altitudeM", 0)).toFixed(3) };
    }),
  def("blackbody", "Radiative flux σT⁴ (W/m²) at a surface temperature.", T(["tempC"], [["tempC", "number", "°C"]]),
    (a) => ({ fluxWm2: +blackbodyFlux(num(a, "tempC")).toFixed(0) })),
  def("emissivity-table", "Surface emissivities for radiation heat transfer.", T([], []),
    () => Object.values(EMISSIVITY).map((e) => ({ id: e.id, emissivity: e.e }))),
  def("sound-through", "Ultrasonic transit time + impedance through a material slab.", T(["material", "thicknessM"], [["material", "string", "material id"], ["thicknessM", "number", "slab thickness m"]]),
    (a) => {
      const m = MATERIALS[str(a, "material")];
      if (!m?.soundMs) return { error: "no sound-speed data" };
      const d = num(a, "thicknessM", 0.1);
      return { material: m.name, soundMs: m.soundMs, transitUs: +(d / m.soundMs * 1e6).toFixed(1), impedanceMRayl: +(m.density * m.soundMs / 1e6).toFixed(2) };
    }),
  def("codex-version", "Dataset version + families stamped on every verdict.", T([], []),
    () => ({ codex: CODEX_VERSION, families: Object.values(CITATIONS).map((c) => c.family) })),
  def("validate", "Self-certification: the 120 Hz sim vs closed-form answers, with error %.", T([], []),
    () => {
      const checks: { name: string; expected: number; got: number; errPct: number; pass: boolean }[] = [];
      const check = (name: string, expected: number, got: number, tolPct: number) => {
        const errPct = Math.abs((got - expected) / Math.max(1e-9, expected)) * 100;
        checks.push({ name, expected: +expected.toFixed(2), got: +got.toFixed(2), errPct: +errPct.toFixed(2), pass: errPct <= tolPct });
      };
      // 1. Vacuum projectile: 30 m/s @45° from 10 m must match the analytic arc at first touchdown.
      {
        const w = new EngineWorld();
        w.env.airDensity = 0;
        const v0 = 30, h0 = 10;
        const b = w.spawn({ shape: "sphere", material: "steel", sizeM: 0.2,
          pos: { x: 0, y: h0, z: 0 },
          vel: { x: v0 * Math.cos(Math.PI / 4), y: v0 * Math.sin(Math.PI / 4), z: 0 }, dragProfile: "sphere" });
        const vy0 = v0 * Math.sin(Math.PI / 4), vx0 = v0 * Math.cos(Math.PI / 4);
        const tF = (vy0 + Math.sqrt(vy0 * vy0 + 2 * w.env.gravity * h0)) / w.env.gravity;
        let touchX = 0;
        for (let i = 0; i < 120 * 12; i++) {
          w.step(1 / 120);
          // Engine-tracked touchdown (exact substep), not end-of-step sampling:
          // post-bounce substeps leave y above rest, which coarse sampling misses.
          if (b.landedT !== null) { touchX = b.pos.x; break; }
        }
        check("vacuum range 30m/s@45°", vx0 * tF, touchX, 2);
      }
      // 2. Terminal velocity: peak fall speed of a draggy body must equal theory.
      {
        const w = new EngineWorld();
        const b = w.spawn({ shape: "sphere", material: "styrofoam", sizeM: 0.5, pos: { x: 0, y: 2000, z: 0 }, dragProfile: "sphere" });
        let peak = 0;
        for (let i = 0; i < 120 * 30; i++) {
          w.step(1 / 120);
          peak = Math.max(peak, Math.abs(b.vel.y));
          if (b.pos.y <= b.radiusM + 1e-6) break;
        }
        check("terminal velocity styrofoam 0.5m", terminalVelocity(b.massKg, b.dragCd, b.areaM2, w.env.airDensity), peak, 5);
      }
      // 3. Free fall position in vacuum at t=1 s: y = 20 − g/2.
      {
        const w = new EngineWorld();
        w.env.airDensity = 0;
        const b = w.spawn({ shape: "sphere", material: "steel", sizeM: 0.1, pos: { x: 0, y: 20, z: 0 }, dragProfile: "sphere" });
        w.run(1);
        check("vacuum free-fall y@1s", 20 - w.env.gravity / 2, b.pos.y, 1);
      }
      // 4. Buoyancy equilibrium: oak box (750/1000) floats with center at 1.45 m.
      {
        const w = new EngineWorld();
        w.addFluid({ name: "Water", min: { x: -3, y: 0, z: -3 }, max: { x: 3, y: 1.7, z: 3 }, density: 1000, viscosity: 0.001 });
        const oak = w.spawn({ shape: "box", material: "oak", sizeM: 0.5, pos: { x: 0, y: 5, z: 0 } });
        w.run(15);
        check("oak float equilibrium", 1.45, oak.pos.y, 20);
      }
      const maxErr = Math.max(...checks.map((c) => c.errPct));
      return { codex: CODEX_VERSION, checks, maxErrPct: +maxErr.toFixed(2), allPass: checks.every((c) => c.pass) };
    }),
  // ---- simulation (stateful world in ctx) ----
  def("sim-spawn", "Spawn a body (or registry model by index) into the world.", T([], [["material", "string", "default oak"], ["sizeM", "number", "default 1"], ["shape", "string", "box|sphere"], ["heightM", "number", "default 10"], ["modelIndex", "number", "optional registry spawn"], ["tempC", "number", "optional"], ["ghost", "boolean", "nested cargo: skips body contact"], ["spin", "number", "optional z spin rad/s (Magnus lift, approx)"]]),
    (a, ctx) => {
      const w = W(ctx);
      if (a.modelIndex !== undefined) return { id: spawnModel(w, num(a, "modelIndex"), { x: 0, y: num(a, "heightM", 10), z: 0 }) };
      const b = w.spawn({ shape: (str(a, "shape", "box") === "sphere" ? "sphere" : "box"), material: str(a, "material", "oak"), sizeM: num(a, "sizeM", 1), pos: { x: 0, y: num(a, "heightM", 10), z: 0 }, tempC: a.tempC !== undefined ? num(a, "tempC") : undefined, ghost: a.ghost === true, spin: a.spin !== undefined ? { x: 0, y: 0, z: num(a, "spin") } : undefined });
      return { id: b.id, massKg: +b.massKg.toFixed(1) };
    }),
  def("sim-run", "Step the world N seconds at 120 Hz. Returns events.", T([], [["seconds", "number", "default 5"]]),
    (a, ctx) => ({ events: W(ctx).run(num(a, "seconds", 5)), t: +W(ctx).time.toFixed(2) })),
  def("sim-list", "All live bodies + state.", T([], []), (a, ctx) => W(ctx).sample()),
  def("sim-remove", "Remove a body by id.", T(["id"], [["id", "string", "body id"]]),
    (a, ctx) => { const w = W(ctx); const n = w.bodies.length; w.bodies = w.bodies.filter((b) => b.id !== str(a, "id")); return { removed: n - w.bodies.length }; }),
  def("sim-reset", "Clear world + clock.", T([], []), (a, ctx) => { const w = W(ctx); w.bodies = []; w.fluids = []; w.tethers = []; w.time = 0; w.log = []; return { ok: true }; }),
  def("sim-fluid", "Pour a fluid pool into the world (visible tank of real fluid).", T(["name", "x", "z"], [["name", "string", "fluid id"], ["x", "number", "center x"], ["z", "number", "center z"], ["halfM", "number", "half-size, default 3"], ["depthM", "number", "default 2"]]),
    (a, ctx) => {
      const w = W(ctx);
      const f = FLUIDS[str(a, "name")] ?? FLUIDS.water;
      const half = num(a, "halfM", 3), depth = num(a, "depthM", 2);
      const x = num(a, "x"), z = num(a, "z");
      w.addFluid({ name: f.name, min: { x: x - half, y: 0, z: z - half }, max: { x: x + half, y: depth, z: z + half }, density: f.density ?? 1000, viscosity: f.viscosity });
      return { pool: f.name, surfaceY: depth };
    }),
  def("sim-env", "Set gravity/ambient/air/wind by planet preset or raw values.", T([], [["planet", "string", "optional preset"], ["gravity", "number", "optional"], ["ambientC", "number", "optional"], ["airDensity", "number", "optional"], ["wind", "number", "optional +x wind m/s (tailwind for +x throws)"]]),
    (a, ctx) => {
      const w = W(ctx);
      const p = str(a, "planet") ? PLANETS[str(a, "planet")] : undefined;
      if (p) { w.env.gravity = p.gravity; if (p.tempC !== null) w.env.ambientC = p.tempC; }
      if (a.gravity !== undefined) w.env.gravity = num(a, "gravity");
      if (a.ambientC !== undefined) w.env.ambientC = num(a, "ambientC");
      if (a.airDensity !== undefined) w.env.airDensity = num(a, "airDensity");
      if (a.wind !== undefined) w.env.wind = { x: num(a, "wind"), y: 0, z: 0 };
      return { env: w.env };
    }),
  // ---- experience ----
  def("verdict", "Full prompt→simulate→verdict experience.", T(["prompt"], [["prompt", "string", "natural-language experiment"]]),
    (a) => experience(str(a, "prompt"))),
  def("scenario", "JSON scenario run (agents prefer this).", T(["json"], [["json", "string", "ScenarioDesc JSON"]]),
    (a) => runScenario("tool-scenario", JSON.parse(str(a, "json")) as Parameters<typeof runScenario>[1])),
  def("batch", "Verdicts for many prompts, one line each.", T(["prompts"], [["prompts", "string", "prompts separated by |"]]),
    (a) => str(a, "prompts").split("|").map((p) => { const r = experience(p.trim()); return { prompt: p.trim(), verdict: r.verdict, confidence: r.confidence, reasons: r.reasons.slice(0, 2) }; })),
  // ---- neo (in-world AI: parse → plan → stage → judge, no AI API) ----
  def("neo-parse", "Neo parses a sentence into WHAT/OBJECT/FROM/TO plan + tool choice.", T(["prompt"], [["prompt", "string", "natural-language experiment"]]),
    (a) => { const plan = neoParse(str(a, "prompt")); const t = neoToolFor(plan); return { ...plan, tool: t.tool, toolWhy: t.why }; }),
  def("neo-scenario", "Neo parses a sentence and returns the deterministic scenario JSON it would stage.", T(["prompt"], [["prompt", "string", "natural-language experiment"]]),
    (a) => { const plan = neoParse(str(a, "prompt")); return { plan, scenario: neoScenario(plan) }; }),
  def("neo-samples", "Deterministic sample sentences from Neo's grammar (seeded).", T([], [["seed", "number", "default 7"], ["n", "number", "default 10"]]),
    (a) => ({ patterns: neoPatternCount(), samples: neoSamples(num(a, "seed", 7), Math.min(50, Math.max(1, num(a, "n", 10)))) })),
];

export function runTool(name: string, args: Args = {}, ctx: ToolCtx = {}): { ok: boolean; result: unknown } {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { ok: false, result: { error: `unknown tool ${name}`, tools: TOOLS.map((x) => x.name) } };
  try {
    return { ok: true, result: t.run(args, ctx) };
  } catch (e) {
    return { ok: false, result: { error: (e as Error).message } };
  }
}
