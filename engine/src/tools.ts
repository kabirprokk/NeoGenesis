// Tool registry — every capability the engine offers an AI agent, as callable tools
// with JSON schemas (OpenAI-function style). 35 tools across data, physics,
// simulation, models, and experience. Headless via CLI: npm run experience -- --tool <name> '<json>'.
import { PHYSICS } from "./constants.js";
import { MATERIALS, FLUIDS, DRAG_CD, MOHS_LADDER, EXPLOSIVES, explosiveClass, FRICTION_PAIRS, REPOSE_DEG, STARS, GASES } from "./materials.js";
import { PLANETS } from "./planets.js";
import { EngineWorld } from "./world.js";
import { getModel, spawnModel, MODEL_COUNT, MODEL_CLASSES } from "./models.js";
import { experience, runScenario } from "./experience.js";
import { terminalVelocity, projectileRange, impact, buoyancyVerdict, soundDelay, slidesOnIncline, reposeOk } from "./physics.js";

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
  // ---- simulation (stateful world in ctx) ----
  def("sim-spawn", "Spawn a body (or registry model by index) into the world.", T([], [["material", "string", "default oak"], ["sizeM", "number", "default 1"], ["shape", "string", "box|sphere"], ["heightM", "number", "default 10"], ["modelIndex", "number", "optional registry spawn"], ["tempC", "number", "optional"]]),
    (a, ctx) => {
      const w = W(ctx);
      if (a.modelIndex !== undefined) return { id: spawnModel(w, num(a, "modelIndex"), { x: 0, y: num(a, "heightM", 10), z: 0 }) };
      const b = w.spawn({ shape: (str(a, "shape", "box") === "sphere" ? "sphere" : "box"), material: str(a, "material", "oak"), sizeM: num(a, "sizeM", 1), pos: { x: 0, y: num(a, "heightM", 10), z: 0 }, tempC: a.tempC !== undefined ? num(a, "tempC") : undefined });
      return { id: b.id, massKg: +b.massKg.toFixed(1) };
    }),
  def("sim-run", "Step the world N seconds at 120 Hz. Returns events.", T([], [["seconds", "number", "default 5"]]),
    (a, ctx) => ({ events: W(ctx).run(num(a, "seconds", 5)), t: +W(ctx).time.toFixed(2) })),
  def("sim-list", "All live bodies + state.", T([], []), (a, ctx) => W(ctx).sample()),
  def("sim-remove", "Remove a body by id.", T(["id"], [["id", "string", "body id"]]),
    (a, ctx) => { const w = W(ctx); const n = w.bodies.length; w.bodies = w.bodies.filter((b) => b.id !== str(a, "id")); return { removed: n - w.bodies.length }; }),
  def("sim-reset", "Clear world + clock.", T([], []), (a, ctx) => { const w = W(ctx); w.bodies = []; w.fluids = []; w.time = 0; w.log = []; return { ok: true }; }),
  def("sim-fluid", "Pour a fluid pool into the world (visible tank of real fluid).", T(["name", "x", "z"], [["name", "string", "fluid id"], ["x", "number", "center x"], ["z", "number", "center z"], ["halfM", "number", "half-size, default 3"], ["depthM", "number", "default 2"]]),
    (a, ctx) => {
      const w = W(ctx);
      const f = FLUIDS[str(a, "name")] ?? FLUIDS.water;
      const half = num(a, "halfM", 3), depth = num(a, "depthM", 2);
      const x = num(a, "x"), z = num(a, "z");
      w.addFluid({ name: f.name, min: { x: x - half, y: 0, z: z - half }, max: { x: x + half, y: depth, z: z + half }, density: f.density ?? 1000, viscosity: f.viscosity });
      return { pool: f.name, surfaceY: depth };
    }),
  def("sim-env", "Set gravity/ambient/air by planet preset or raw values.", T([], [["planet", "string", "optional preset"], ["gravity", "number", "optional"], ["ambientC", "number", "optional"], ["airDensity", "number", "optional"]]),
    (a, ctx) => {
      const w = W(ctx);
      const p = str(a, "planet") ? PLANETS[str(a, "planet")] : undefined;
      if (p) { w.env.gravity = p.gravity; if (p.tempC !== null) w.env.ambientC = p.tempC; }
      if (a.gravity !== undefined) w.env.gravity = num(a, "gravity");
      if (a.ambientC !== undefined) w.env.ambientC = num(a, "ambientC");
      if (a.airDensity !== undefined) w.env.airDensity = num(a, "airDensity");
      return { env: w.env };
    }),
  // ---- experience ----
  def("verdict", "Full prompt→simulate→verdict experience.", T(["prompt"], [["prompt", "string", "natural-language experiment"]]),
    (a) => experience(str(a, "prompt"))),
  def("scenario", "JSON scenario run (agents prefer this).", T(["json"], [["json", "string", "ScenarioDesc JSON"]]),
    (a) => runScenario("tool-scenario", JSON.parse(str(a, "json")) as Parameters<typeof runScenario>[1])),
  def("batch", "Verdicts for many prompts, one line each.", T(["prompts"], [["prompts", "string", "prompts separated by |"]]),
    (a) => str(a, "prompts").split("|").map((p) => { const r = experience(p.trim()); return { prompt: p.trim(), verdict: r.verdict, confidence: r.confidence, reasons: r.reasons.slice(0, 2) }; })),
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
