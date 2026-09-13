// In-game terminal core: parses lines, runs engine tools against the LIVE world,
// and answers as the built-in lab assistant. UI lives in Terminal.tsx; the same
// executor can drive headless agents.
import { runTool, TOOLS } from "../../../engine/src/index.js";
import type { EngineWorld } from "../../../engine/src/index.js";
import type { NeoPlan } from "../../../engine/src/index.js";
import type { ExperienceResult } from "../../../engine/src/index.js";

export interface NeoRunResult {
  plan: NeoPlan | null; verdict: ExperienceResult; staged: string[] | null;
  memory: { runs: number; words: number; unknown: number };
}

export interface GameCtx {
  world: EngineWorld;
  pos: () => { x: number; y: number; z: number };
  teleport: (x: number, z: number) => void;
  lookAt: (x: number, z: number) => void;
  setTime: (h: number) => void;
  setWeather: (kind: string) => void;
  addJournal: (text: string) => void;
  doSave: () => void;
  /** One flow: parse → build the rig in the live world → face it → judge. */
  runExperiment: (prompt: string) => NeoRunResult;
}

// Live event stream: App drains world.log into fn while want is true.
export const watchBus: { fn: null | ((lines: string[]) => void); want: boolean } = { fn: null, want: false };

const SKILLS = ["drop-test", "material-showdown", "planet-survey", "float-or-sink",
  "scratch-ladder", "blast-analysis", "friction-audit", "thermal-sweep"];
const SKILL_FOR: [RegExp, string][] = [
  [/fall|drop|crash|land|survive/i, "drop-test"],
  [/ vs |better|best|stronger|which material/i, "material-showdown"],
  [/mars|moon|venus|jupiter|saturn|titan|planet|space/i, "planet-survey"],
  [/float|sink|swim|boat|buoy/i, "float-or-sink"],
  [/scratch|cut|mine|pickaxe|tier|chis/i, "scratch-ladder"],
  [/explos|blast|tnt|detonat|bomb/i, "blast-analysis"],
  [/slip|slid|friction|climb|grip|slope|avalanche/i, "friction-audit"],
  [/melt|burn|fire|heat|ignite|lava/i, "thermal-sweep"],
];

function verdictLines(prompt: string, full: boolean): string[] {
  const v = verdictResult(prompt);
  if (!v) return [`error: could not judge that`];
  const out = [`${v.id} · ${v.verdict} (${v.confidence}) · ${v.environment}`];
  if (full) out.push(`measurements: ${JSON.stringify(v.measurements)}`);
  const uncKeys = Object.keys(v.uncertainty);
  if (full && uncKeys.length) out.push(`error bars: ${uncKeys.map((k) => `${k} ${v.uncertainty[k]}`).join(" | ")}`);
  if (full && v.citations.length) out.push(`cite: ${v.citations.join(", ")} (use \`cite <ids>\` for BibTeX)`);
  for (const line of v.reasons.slice(0, full ? 6 : 2)) out.push(`• ${line}`);
  if (full) for (const e of v.events.slice(0, 4)) out.push(`! ${e}`);
  return out;
}

export interface RunRecord {
  n: number; id: string; prompt: string; verdict: string; confidence: number;
  environment: string; measurements: Record<string, unknown>; uncertainty: Record<string, string>;
  citations: string[]; reasons: string[]; events: string[]; at: string;
}
// Peer-review trail: every judged prompt is logged with its experiment ID.
const runHistory: RunRecord[] = [];

function verdictResult(prompt: string): RunRecord | null {
  const r = runTool("verdict", { prompt });
  if (!r.ok) return null;
  const v = r.result as { id: string; verdict: string; confidence: number; environment: string;
    measurements: Record<string, unknown>; uncertainty: Record<string, string>; citations: string[];
    reasons: string[]; events: string[] };
  const rec: RunRecord = {
    n: runHistory.length + 1, id: v.id, prompt, verdict: v.verdict, confidence: v.confidence,
    environment: v.environment, measurements: v.measurements, uncertainty: v.uncertainty ?? {}, citations: v.citations ?? [],
    reasons: v.reasons, events: v.events ?? [], at: new Date().toISOString(),
  };
  runHistory.push(rec);
  if (runHistory.length > 200) runHistory.splice(0, runHistory.length - 200);
  return rec;
}

function diffRuns(a: string, b: string): string[] {
  const ra = runHistory.find((x) => String(x.n) === a || x.id === a);
  const rb = runHistory.find((x) => String(x.n) === b || x.id === b);
  if (!ra || !rb) return [`need two run numbers from \`runs\` — got "${a}" "${b}"`];
  const out = [`diff #${ra.n} ${ra.id} (${ra.verdict}) vs #${rb.n} ${rb.id} (${rb.verdict})`];
  out.push(`A: ${ra.prompt.slice(0, 80)}`);
  out.push(`B: ${rb.prompt.slice(0, 80)}`);
  const keys = [...new Set([...Object.keys(ra.measurements), ...Object.keys(rb.measurements)])];
  let shown = 0;
  for (const k of keys) {
    const va = JSON.stringify(ra.measurements[k]), vb = JSON.stringify(rb.measurements[k]);
    if (va !== vb && shown < 12) { out.push(`~ ${k}: ${va} → ${vb}`); shown++; }
  }
  if (!shown) out.push("measurements identical — rerun reproduces exactly (deterministic engine)");
  return out;
}

export function execCommand(raw: string, g: GameCtx): string[] {
  const cmd = raw.trim();
  if (!cmd) return [];
  const [head, ...rest] = cmd.split(/\s+/);
  const tail = rest.join(" ");
  const h = head.toLowerCase();

  if (h === "help") return [
    "commands: do <experiment> (STAGE it live) | verdict <prompt> | ai <question> |",
    "neo understands follow-ups: `again, but on Mars` · `make it heavier` ·",
    "`twice as big` · `no, I meant steel` · `if the glass breaks, drop steel` ·",
    "`who lands first` · `over the wall` · `half-full` · `with backspin` |",
    "spawn-body <mat> <size> [height] | cannon <mat> [speed] | rain <mat> [n] |",
    "fireworks | volcano | duel <matA> <matB> | bodies | sim <s> | events | watch |",
    "gravity <planet|value> | ambient <C> | planet <id> | teleport <x> <z> | time <h> |",
    "weather <clear|rain|storm> | journal <text> | save | whereami | remove <id> | reset |",
    "tool <name> <json> | tools | skills | clear | json <prompt> (full verdict JSON for lab notebooks) |",
    "csv <prompt> (trace spreadsheet) | runs (provenance log) | diff <a> <b> (rerun diff) | cite [ids] (BibTeX)",
    "anything else ending in ? is judged as an experiment.",
  ];
  if (h === "tools") return TOOLS.map((t) => `${t.name} — ${t.description}`);
  if (h === "skills") return SKILLS.map((s) => `${s} — see skills/${s}/SKILL.md`);
  if (h === "clear") return ["__clear__"];
  if (h === "whereami") { const p = g.pos(); return [`x=${p.x.toFixed(1)} z=${p.z.toFixed(1)} y=${p.y.toFixed(1)}`]; }
  if (h === "bodies") {
    const r = runTool("sim-list", {}, { world: g.world });
    const s = r.result as { t: number; bodies: { id: string; y: number; v: number; broken: boolean }[] };
    if (!s.bodies.length) return ["world empty — spawn-body oak 1"];
    return [`t=${s.t.toFixed(1)}s`, ...s.bodies.map((b) => `${b.id} y=${b.y.toFixed(1)} v=${b.v.toFixed(1)}${b.broken ? " BROKEN" : ""}`)];
  }
  if (h === "spawn-body") {
    const [mat = "oak", size = "1", height = "8"] = rest;
    const p = g.pos();
    // spawn ahead of the player so it falls into view
    const w = g.world;
    const b = w.spawn({ shape: "box", material: mat, sizeM: parseFloat(size) || 1, pos: { x: p.x + 4, y: parseFloat(height) || 8, z: p.z } });
    return [`spawned ${b.id} (${mat}, ${b.massKg.toFixed(0)} kg) at ${parseFloat(height) || 8} m — watch it fall`];
  }
  if (h === "remove") {
    const r = runTool("sim-remove", { id: tail }, { world: g.world });
    return [JSON.stringify(r.result)];
  }
  if (h === "reset") {
    runTool("sim-reset", {}, { world: g.world });
    return ["world cleared — fresh plane, same physics"];
  }
  if (h === "cannon") {
    const [mat = "steel", speed = "60"] = rest;
    const p = g.pos();
    const v = Math.min(1500, Math.max(1, parseFloat(speed) || 60));
    const b = g.world.spawn({ shape: "sphere", material: mat, sizeM: 0.4,
      pos: { x: p.x, y: 2, z: p.z }, vel: { x: 0, y: v * 0.5, z: -v }, dragProfile: "sphere" });
    return [`cannon fired: ${mat} ball (${b.massKg.toFixed(0)} kg) at ${v} m/s — watch the streak`];
  }
  if (h === "rain") {
    const [mat = "ice", nStr = "12"] = rest;
    const p = g.pos();
    const n = Math.min(40, Math.max(1, parseInt(nStr) || 12));
    for (let i = 0; i < n; i++) {
      g.world.spawn({ shape: Math.random() < 0.5 ? "sphere" : "box", material: mat, sizeM: 0.25 + Math.random() * 0.4,
        pos: { x: p.x + (Math.random() - 0.5) * 30, y: 40 + Math.random() * 40, z: p.z + (Math.random() - 0.5) * 30 } });
    }
    return [`${n}× ${mat} raining from the sky over your head — look up`];
  }
  if (h === "fireworks") {
    const p = g.pos();
    const mats = ["copper", "gold", "titanium", "glass", "lead"];
    for (let i = 0; i < 6; i++) {
      g.world.spawn({ shape: "sphere", material: mats[i % mats.length], sizeM: 0.25,
        pos: { x: p.x + (Math.random() - 0.5) * 20, y: 2, z: p.z - 10 - Math.random() * 10 },
        vel: { x: (Math.random() - 0.5) * 8, y: 28 + Math.random() * 14, z: (Math.random() - 0.5) * 8 },
        tempC: 600, dragProfile: "sphere" });
    }
    return ["fireworks up — burning metal rising, gravity decides the rest"];
  }
  if (h === "volcano") {
    const p = g.pos();
    const ax = p.x + 12, az = p.z - 8;
    g.world.addFluid({ name: "Molten Lava", min: { x: ax - 4, y: 0, z: az - 4 },
      max: { x: ax + 4, y: 1.7, z: az + 4 }, density: 2600, viscosity: 1000, tempC: 1000 });
    for (let i = 0; i < 8; i++) {
      g.world.spawn({ shape: "sphere", material: "granite", sizeM: 0.3 + Math.random() * 0.4,
        pos: { x: ax + (Math.random() - 0.5) * 4, y: 3 + Math.random() * 8, z: az + (Math.random() - 0.5) * 4 },
        vel: { x: (Math.random() - 0.5) * 14, y: 12 + Math.random() * 10, z: (Math.random() - 0.5) * 14 },
        tempC: 900, dragProfile: "sphere" });
    }
    return [`volcano at ${ax.toFixed(0)}, ${az.toFixed(0)} — live lava pool + erupting granite bombs`];
  }
  if (h === "duel") {
    const [matA = "steel", matB = "glass"] = rest;
    const p = g.pos();
    const mk = (mat: string, dx: number) => g.world.spawn({ shape: "box", material: mat, sizeM: 0.6,
      pos: { x: p.x + dx, y: 50, z: p.z - 10 } });
    const a = mk(matA, -2), b = mk(matB, 2);
    return [`duel: ${matA} (${a.massKg.toFixed(0)} kg) vs ${matB} (${b.massKg.toFixed(0)} kg) from 50 m — place your bets, verdict in \`events\``];
  }
  if (h === "sim") {
    const r = runTool("sim-run", { seconds: parseFloat(tail) || 5 }, { world: g.world });
    const v = r.result as { events: string[]; t: number };
    return v.events.length ? [...v.events.slice(0, 8), `t=${v.t}s`] : [`quiet — nothing broke (t=${v.t}s)`];
  }
  if (h === "gravity" || h === "planet") {
    const n = parseFloat(tail);
    const r = runTool("sim-env", Number.isNaN(n) ? { planet: tail || "earth" } : { gravity: n }, { world: g.world });
    return [`env: ${JSON.stringify((r.result as { env: unknown }).env)}`];
  }
  if (h === "ambient") {
    const r = runTool("sim-env", { ambientC: parseFloat(tail) || 15 }, { world: g.world });
    return [`ambient set: ${JSON.stringify((r.result as { env: unknown }).env)}`];
  }
  if (h === "teleport") {
    const [x = "0", z = "0"] = rest;
    g.teleport(parseFloat(x) || 0, parseFloat(z) || 0);
    return [`teleported to ${x}, ${z}`];
  }
  if (h === "time") { g.setTime(parseFloat(tail) || 10); return [`time set to ${tail}h`]; }
  if (h === "weather") { g.setWeather(tail || "clear"); return [`weather: ${tail || "clear"}`]; }
  if (h === "journal") { g.addJournal(tail); return [`recorded in field journal`]; }
  if (h === "save") { g.doSave(); return [`saved`]; }
  if (h === "tool") {
    const [name, ...js] = rest;
    let args = {};
    try { args = JSON.parse(js.join(" ") || "{}"); } catch { return [`bad JSON args`]; }
    const r = runTool(name, args, { world: g.world });
    return [JSON.stringify(r.result, null, 1).slice(0, 1500)];
  }
  if (h === "do" || h === "stage") {
    const r = g.runExperiment(tail);
    watchBus.want = true;
    const head = r.plan?.action
      ? [`neo: ${r.plan.steps.map(([k, v]) => `${k} ${v}`).join(" · ")}`]
      : [`neo: no action word — judged without staging`];
    return [...head, ...(r.staged ?? []),
      `${r.verdict.verdict} (${r.verdict.confidence})`,
      ...r.verdict.reasons.slice(0, 2),
      "streaming live events — `watch` to stop"];
  }
  if (h === "watch") {
    watchBus.want = !watchBus.want;
    return [watchBus.want ? "streaming live engine events" : "stream stopped — `events` replays the log"];
  }
  if (h === "events") {
    const log = g.world.log.slice(-8);
    return log.length ? log.map((l) => `! ${l}`) : ["no events yet — stage something with `do`"];
  }
  if (h === "ai") {
    const q = tail;
    const skill = SKILL_FOR.find(([re]) => re.test(q))?.[1] ?? null;
    return [skill ? `assistant → skill: ${skill} (skills/${skill}/SKILL.md)` : `assistant → full experience run (no single skill)`, ...verdictLines(q, true)];
  }
  if (h === "verdict") return verdictLines(tail, true);
  if (h === "runs") {
    if (!runHistory.length) return ["no judged runs yet — try `verdict drop a glass box from 50m`"];
    return runHistory.slice(-15).map((x) => `#${x.n} ${x.id} ${x.verdict} (${x.confidence}) — ${x.prompt.slice(0, 70)}`);
  }
  if (h === "diff") {
    const [a = "", b = ""] = rest;
    return diffRuns(a, b);
  }
  if (h === "cite") {
    const r = runTool("citations", tail ? { ids: tail } : {});
    return (r.result as string[]).length ? r.result as string[] : ["no citations for those ids — `citations` tool lists families"];
  }
  if (h === "csv") {
    const r = runTool("csv", { prompt: tail });
    const c = (r.result as { csv: string }).csv;
    const lines = c.split("\n");
    return [...lines.slice(0, 12), lines.length > 12 ? `… ${lines.length - 12} more rows (full CSV in JSON via \`tool csv\`)` : "end of trace"];
  }
  if (h === "json") {
    // Full machine-readable verdict for lab notebooks: copy the output as-is.
    const r = runTool("verdict", { prompt: tail });
    if (!r.ok) return [`error: ${JSON.stringify(r.result)}`];
    return [JSON.stringify(r.result)];
  }
  // Default: questions and experiment-shaped sentences get judged.
  if (/[?]$/.test(cmd) || /^(is|can|does|would|will|what|how|should)/i.test(cmd)) return verdictLines(cmd, false);
  return [`unknown command — try: help | verdict <prompt> | ai <question>`];
}
