// In-game terminal core: parses lines, runs engine tools against the LIVE world,
// and answers as the built-in lab assistant. UI lives in Terminal.tsx; the same
// executor can drive headless agents.
import { runTool, TOOLS } from "../../../engine/src/index.js";
import type { EngineWorld } from "../../../engine/src/index.js";
import { stagePrompt } from "./stage.js";

export interface GameCtx {
  world: EngineWorld;
  pos: () => { x: number; y: number; z: number };
  teleport: (x: number, z: number) => void;
  setTime: (h: number) => void;
  setWeather: (kind: string) => void;
  addJournal: (text: string) => void;
  doSave: () => void;
  stage: (prompt: string) => string[] | null;
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
  const r = runTool("verdict", { prompt });
  if (!r.ok) return [`error: ${JSON.stringify(r.result)}`];
  const v = r.result as { verdict: string; confidence: number; environment: string;
    measurements: Record<string, unknown>; reasons: string[]; events: string[] };
  const out = [`${v.verdict} (${v.confidence}) · ${v.environment}`];
  if (full) out.push(`measurements: ${JSON.stringify(v.measurements)}`);
  for (const line of v.reasons.slice(0, full ? 6 : 2)) out.push(`• ${line}`);
  if (full) for (const e of v.events.slice(0, 4)) out.push(`! ${e}`);
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
    "spawn-body <mat> <size> [height] | bodies | sim <s> | events | watch |",
    "gravity <planet|value> | ambient <C> | planet <id> | teleport <x> <z> | time <h> |",
    "weather <clear|rain|storm> | journal <text> | save | whereami | remove <id> |",
    "tool <name> <json> | tools | skills | clear",
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
    const staged = g.stage(tail);
    if (!staged) return verdictLines(tail, false);
    watchBus.want = true;
    return [...staged, "streaming live events — `watch` to stop"];
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
  // Default: questions and experiment-shaped sentences get judged.
  if (/[?]$/.test(cmd) || /^(is|can|does|would|will|what|how|should)/i.test(cmd)) return verdictLines(cmd, false);
  return [`unknown command — try: help | verdict <prompt> | ai <question>`];
}
