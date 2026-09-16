// In-game terminal core: parses lines, runs engine tools against the LIVE world,
// and answers as the built-in lab assistant. UI lives in Terminal.tsx; the same
// executor can drive headless agents.
import { runTool, TOOLS } from "../../../engine/src/index.js";
import type { EngineWorld } from "../../../engine/src/index.js";
import type { NeoPlan } from "../../../engine/src/index.js";
import type { ExperienceResult } from "../../../engine/src/index.js";
import type { NeoFacts } from "./neoMind.js";
import type { InjectorState } from "./neoBody.js";

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
  /** Live senses Neo feels right now (temperature, wind, sun, bodies…). */
  sense: () => NeoFacts;
  /** Talk to Neo's generative mind — novel wording, true numbers, learns. */
  chat: (question: string) => string;
  /** Raw pre-speech thought trace (read-only, for the visualizer). */
  think: (question: string) => string[];
  /** Ring buffer of recent inner lines (thoughts + dreams). */
  thoughtLog: () => string[];
  /** Run the sleep/dream consolidation now. */
  dream: () => string;
  /** Inspectable mind+body summary line. */
  innerState: () => string;
  /** Unprompted utterance Neo initiated while idle (consumed on read). */
  proposal: () => string | null;
  /** Last phrasing distribution actually sampled (for the visualizer). */
  candidates: () => { text: string; p: number }[];
  /** Scientist injector: read synthetic biometric overrides. */
  injector: () => InjectorState;
  /** Set injector overrides (empty = clear back to natural). */
  setInjector: (patch: Partial<InjectorState>) => unknown;
  /** Current mind profile name. */
  mindProfile: () => string;
  /** Hot-swap mind profile mid-sim. Returns false if unknown. */
  setMindProfile: (name: string) => boolean;
}

// Live event stream: App drains world.log into fn while want is true.
export const watchBus: { fn: null | ((lines: string[]) => void); want: boolean } = { fn: null, want: false };

/** Experiment-shaped language → the reality engine must judge it. */
export const EXPERIMENT_RE = /(throw|drop|melt|freeze|burn|boil|crush|float|sink|slide|scratch|blast|build|pour|electrify|dissolve|laser|lase|roll|orbit|launch|hurl|toss|fling|shoot|yeet|lob|chuck|heave|sling|catapult|smash|shatter|explode|detonate|erupt|corrode|plummet|plunge|nosedive|fell|land|crash|collide|ram|cannon|duel|volcano|magma|lift|carry|heft|surviv|versus|\bvs\b|which|stronger|better|spinn|whirl|slip|skid|glide|coast|avalanche|rain )/i;

/** Small-talk + live-sense questions → Neo's generative mind answers. */
export const CHAT_RE = /^(hi|hey|hello|yo|sup|howdy|good\s?(morning|evening|afternoon)|thanks|thank|bye|goodbye|good ?night)\b|who are you|your name|what are you|what can you do|how are you|how do you feel|my name is|call me|remember |temperatur|how (hot|cold|warm|cool)|feels like|degree|°c\b|weather|raining|rainy|storming|stormy|windy|cloudy|humid|foggy|climate|what time|is it (day|night|dark|light)|time is it|where am i|where are we|my position|my location|surround|around (me|us|here)|what do you see|nearby/i;

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
    "talk: ask <anything> | neo <anything> — Neo's generative mind, learns you |",
    "sense | feel — everything Neo feels right now (temp, wind, sun, bodies) |",
    "think <q> — raw pre-speech trace | dream — sleep consolidation now |",
    "inner — mind+body summary | B — brain visualizer square |",
    "scientist: profile [name] — hot-swap mind (steady/volatile/terse/dreamy/feral) |",
    "inject <hr|temp|arousal|valence|dominance> <value> | inject clear |",
    "commands: do <experiment> (STAGE it live) | verdict <prompt> | ai <question> |",
    "neo understands follow-ups: `again, but on Mars` · `make it heavier` ·",
    "`twice as big` · `no, I meant steel` · `if the glass breaks, drop steel` ·",
    "`who lands first` · `over the wall` · `half-full` · `with backspin` |",
    "spawn-body <mat> <size> [height] | cannon <mat> [speed] | rain <mat> [n] |",
    "fireworks | volcano | duel <matA> <matB> | fun [meteor|anvils|shower|eruption|duel] |",
    "bodies | sim <s> | events | watch |",
    "gravity <planet|value> | ambient <C> | planet <id> | teleport <x> <z> | time <h> |",
    "weather <clear|rain|storm> | journal <text> | save | whereami | remove <id> | reset |",
    "tool <name> <json> | tools | skills | clear | json <prompt> (full verdict JSON for lab notebooks) |",
    "csv <prompt> (trace spreadsheet) | runs (provenance log) | diff <a> <b> (rerun diff) | cite [ids] (BibTeX)",
    "plain talk (no action verbs) goes to Neo's mind; action sentences run experiments.",
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
  if (h === "fun") {
    const kind = (tail || "surprise").toLowerCase();
    const p = g.pos();
    const pick = kind === "surprise" ? ["meteor", "anvils", "shower", "eruption"][Math.floor(Math.random() * 4)] : kind;
    if (pick === "meteor") {
      for (let i = 0; i < 5; i++) {
        g.world.spawn({ shape: "sphere", material: "granite", sizeM: 0.4 + Math.random() * 0.5,
          pos: { x: p.x + (Math.random() - 0.5) * 40, y: 50 + Math.random() * 30, z: p.z - 15 - Math.random() * 20 },
          vel: { x: (Math.random() - 0.5) * 10, y: -20 - Math.random() * 15, z: 5 + Math.random() * 8 },
          tempC: 800, dragProfile: "sphere" });
      }
      return ["meteor strike incoming — burning granite, look up and run"];
    }
    if (pick === "anvils" || pick === "anvil") {
      for (let i = 0; i < 6; i++) {
        g.world.spawn({ shape: "box", material: "iron", sizeM: 0.5,
          pos: { x: p.x + (Math.random() - 0.5) * 24, y: 35 + Math.random() * 20, z: p.z + (Math.random() - 0.5) * 24 } });
      }
      return ["anvil rain — 6 iron blocks falling around you (each ~200 kg). They shove, not you"];
    }
    if (pick === "shower" || pick === "gold") {
      for (let i = 0; i < 8; i++) {
        g.world.spawn({ shape: "sphere", material: i % 2 ? "gold" : "glass", sizeM: 0.2 + Math.random() * 0.2,
          pos: { x: p.x + (Math.random() - 0.5) * 20, y: 30 + Math.random() * 20, z: p.z - 8 - Math.random() * 12 },
          dragProfile: "sphere" });
      }
      return ["gold-and-glass shower — catch the verdict: which shatters, which survives"];
    }
    if (pick === "eruption" || pick === "volcano") {
      return execCommand("volcano", g);
    }
    if (pick === "duel") {
      return execCommand("duel steel glass", g);
    }
    return ["fun meteor | fun anvils | fun shower | fun eruption | fun duel — or just `fun` and feel lucky"];
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
  if (h === "ask" || h === "neo" || h === "chat" || h === "talk") {
    if (!tail) return ["talk to me — `ask what is the temperature?`"];
    return [`neo: ${g.chat(tail)}`];
  }
  if (h === "sense" || h === "feel" || h === "senses") {
    const s = g.sense();
    return [
      `neo feels: ${s.tempC.toFixed(1)}°C (feels ${s.feelsLikeC.toFixed(1)}°C, ${s.feelWord}) · wind ${s.windMs.toFixed(1)} m/s · humidity ${Math.round(s.humidity01 * 100)}% · ${s.weatherKind}`,
      `sky: ${s.night ? "night" : `sun ${s.sunAlt.toFixed(0)}°, ${Math.round(s.sunLux).toLocaleString()} lux`} · ${s.timeStr} · gravity ${s.gravity.toFixed(2)} m/s² · at x=${s.posX.toFixed(0)}, z=${s.posZ.toFixed(0)}`,
      `body: heart ${Math.round(s.heartBpm)} BPM · ${s.mood}${s.undertone ? ` + ${s.undertone}` : ""} · arousal ${s.arousal01.toFixed(2)} · dominance ${s.dominance01.toFixed(2)}`,
      s.bodyCount ? `bodies (${s.bodyCount}): ${s.bodies.slice(0, 4).join(" · ")}` : "bodies: open plane, nothing staged",
      s.fluids.length ? `fluids: ${s.fluids.join(" · ")}` : "fluids: none",
      g.innerState(),
    ];
  }
  if (h === "think") {
    if (!tail) return ["think what? — `think is it going to storm?` shows the raw trace"];
    return g.think(tail);
  }
  if (h === "dream") return [g.dream()];
  if (h === "inner" || h === "mind") return [g.innerState(), ...g.thoughtLog().slice(-4)];
  if (h === "profile") {
    if (!tail) return [`mind profile: ${g.mindProfile()} — steady/volatile/terse/dreamy/feral`];
    return [g.setMindProfile(tail) ? `mind profile → ${g.mindProfile()} (live, wording warps now)` : `unknown profile "${tail}" — steady/volatile/terse/dreamy/feral`];
  }
  if (h === "inject") {
    const [slot = "", val = ""] = rest;
    if (!slot || slot === "show") return [`injector: ${JSON.stringify(g.injector())} (synthetic overrides; empty = natural)`];
    if (slot === "clear") { g.setInjector({ hrBpm: null, tempDeltaC: 0, arousalDelta: 0, valenceDelta: 0, dominanceDelta: 0 }); return ["injector cleared — Neo feels only the world again"]; }
    const n = parseFloat(val);
    if (Number.isNaN(n)) return [`inject ${slot} needs a number — e.g. \`inject hr 150\``];
    const patch: Record<string, number | null> = {};
    if (slot === "hr" || slot === "heart") patch.hrBpm = Math.min(200, Math.max(35, n));
    else if (slot === "temp") patch.tempDeltaC = Math.min(15, Math.max(-10, n));
    else if (slot === "arousal") patch.arousalDelta = Math.min(0.6, Math.max(-0.6, n));
    else if (slot === "valence") patch.valenceDelta = Math.min(0.6, Math.max(-0.6, n));
    else if (slot === "dominance") patch.dominanceDelta = Math.min(0.6, Math.max(-0.6, n));
    else return [`unknown slot "${slot}" — hr|temp|arousal|valence|dominance`];
    g.setInjector(patch);
    return [`injected ${slot}=${n} (synthetic — the world itself is untouched)`, g.innerState()];
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
  // Default: experiments run unless the line is clearly small-talk/senses.
  // Questions stay judgeable (the lab judges "can X?", "is Y?"); anything
  // else unrecognized gets guidance — never a junk verdict (a bare
  // "whereami"-with-typo must not come back as "survives a 50 m fall").
  if (EXPERIMENT_RE.test(cmd)) return verdictLines(cmd, false);
  if (CHAT_RE.test(cmd)) {
    try { return [`neo: ${g.chat(cmd)}`]; } catch { return verdictLines(cmd, false); }
  }
  if (/[?]$/.test(cmd) || /^(is|can|does|would|will|what|how|should)\b/i.test(cmd)) return verdictLines(cmd, false);
  return [`unknown command "${head}" — try: help | ask <question> | verdict <prompt> | do <experiment>`];
}
