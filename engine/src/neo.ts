// Neo — the in-world AI. No AI API, no network, no Python: a deterministic
// TypeScript language pipeline (tokenizer → normalizer → fuzzy matcher →
// slot grammar → plan) plus a local memory that learns from every conversation.
//
// A browser cannot import Python packages, so the "many libs" idea lives here
// as dependency-free equivalents: tokenize, stem-ish normalize, Levenshtein
// fuzzy match, unit conversion, combinatorial sentence templates, and a
// persistent word-memory. Everything Neo knows is computed or learned locally.
//
// Pipeline (what the user asked for):
//   WHAT to do  → action verb (throw / melt / crush / …)
//   OBJECT      → shape + material + size  (copper sphere, 0.5 m)
//   FROM where  → height / velocity / angle / temperature
//   WHERE it goes → target (ground, water, lava, honey, …)
//
// Sentence coverage: neoPatternCount() multiplies the slot vocabularies —
// verbs × shapes × materials × size-units × height-units × targets × planets —
// well past 10,000 structures. neoSamples(seed, n) materializes deterministic
// examples from that space, so the "10k dataset" is generated, never stored.
import { MATERIALS, FLUIDS } from "./materials.js";
import { PLANETS } from "./planets.js";
import { altitudeDensity } from "./science.js";
import type { ScenarioDesc } from "./experience.js";

// ---------------------------------------------------------------- vocabulary

export type NeoAction =
  "drop" | "throw" | "melt" | "freeze" | "burn" | "boil" | "crush" |
  "float" | "sink" | "slide" | "scratch" | "blast" | "build" | "pour" |
  "electrify" | "dissolve" | "lase" | "roll";

const VERBS: Record<NeoAction, string[]> = {
  drop: ["drop", "plop", "release"],
  throw: ["throw", "toss", "hurl", "launch", "shoot", "fling", "yeet", "lob"],
  melt: ["melt", "smelt"],
  freeze: ["freeze", "chill", "frost"],
  burn: ["burn", "ignite", "combust", "torch", "incinerate"],
  boil: ["boil", "evaporate"],
  crush: ["crush", "smash", "squash", "shatter", "stomp", "hammer", "flatten"],
  float: ["float", "bob"],
  sink: ["sink", "dunk", "submerge"],
  slide: ["slide", "slip", "glide"],
  scratch: ["scratch", "cut", "mine", "carve", "chisel", "grind"],
  blast: ["blast", "explode", "detonate"],
  build: ["build", "stack", "place", "put", "construct", "assemble"],
  pour: ["pour", "flood", "fill"],
  electrify: ["electrify", "electrocute", "shock", "zap", "taser"],
  dissolve: ["dissolve", "corrode", "etch"],
  lase: ["lase", "laser"],
  roll: ["roll"],
};
// "fire" is genuinely ambiguous (fire a cannon vs set on fire) — resolved by
// context in parse(): velocity/angle/target words → throw, else burn.
const FIRE_WORD = "fire";

const SHAPES: { shape: "box" | "sphere"; words: string[] }[] = [
  { shape: "box", words: ["cube", "box", "block", "crate", "brick", "dice", "ingot"] },
  { shape: "sphere", words: ["sphere", "ball", "orb", "marble", "globe", "bead"] },
];

const MAT_ALIAS: Record<string, string> = {
  wood: "oak", wooden: "oak", timber: "oak", log: "oak",
  metal: "steel", steel: "steel", iron: "iron",
  rock: "concrete", stone: "concrete",
  plastic: "teflon", glass: "glass",
};
const FLUID_ALIAS: Record<string, string> = {
  sea: "water", ocean: "water", pool: "water", pond: "water", lake: "water", river: "water",
  magma: "lava", oil: "motorOil", petrol: "motorOil",
};
const GROUND_WORDS = ["ground", "floor", "plane", "land", "dirt", "concrete", "earth", "normal"];

const ACID_ALIAS: Record<string, string> = {
  "battery acid": "batteryAcid", "gastric acid": "gastricAcid", "stomach acid": "gastricAcid",
  "drain cleaner": "drainCleaner", bleach: "bleach",
};
// Context words Neo recognizes (no slot, but never "unknown").
const KNOWN_EXTRA = new Set([
  "laser", "lase", "beam", "radiation", "geiger", "sievert", "isotope", "uranium",
  "plutonium", "cobalt", "radon", "tritium", "ppm", "toxic", "altitude", "voltage",
  "volts", "volt", "kv", "acid", "battery", "drain", "cleaner", "bleach", "corrode",
  "dissolve", "electrify", "shock", "zap", "roll", "rolling", "asphalt", "mud",
  "snow", "gravel", "sand", "rail", "train", "truck", "human", "fall", "survive",
]);

const SIZE_UNITS: [string, number][] = [["mm", 0.001], ["cm", 0.01], ["in", 0.0254], ["ft", 0.3048], ["m", 1], ["km", 1000]];
const HEIGHT_CUES = ["from", "above", "up", "high", "height", "altitude", "tall", "hovering", "dangle", "hanging"];
const SIZE_CUES = ["size", "sized", "wide", "thick", "diameter", "across"];
const TARGET_CUES = ["in", "into", "onto", "on", "over", "through", "inside"];

const STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "at", "of", "to", "into", "onto", "from", "and",
  "with", "please", "neo", "hey", "hi", "can", "you", "what", "happens", "if",
  "i", "want", "like", "me", "show", "do", "does", "is", "it", "this", "that",
  "there", "some", "over", "out", "up", "for", "we", "will", "would", "should",
  "could", "my", "by", "as", "or", "more", "than", "then", "when", "while",
]);

// ------------------------------------------------------------------- helpers

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let cur = i;
    let prevDiag = i - 1;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, cur + 1, prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur = prev[j];
      prevDiag = tmp;
    }
    void cur;
  }
  return prev[n];
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function unitToM(unit: string): number {
  const u = SIZE_UNITS.find(([k]) => k === unit);
  return u ? u[1] : 1;
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ------------------------------------------------------------------- plan

export interface NeoTarget { kind: "ground" | "fluid"; fluid?: string; word: string }
export interface NeoPlan {
  action: NeoAction | null;
  actionWord: string;
  shape: "box" | "sphere";
  shapeWord: string;
  material: string;
  materialWord: string;
  sizeM: number;
  heightM: number | null;
  velMs: number | null;
  angleDeg: number | null;
  tempC: number | null;
  pourFluid: string | null;
  acid: string | null;
  altitudeM: number | null;
  target: NeoTarget;
  planet: string;
  confidence: number;
  steps: [string, string][]; // WHAT / OBJECT / FROM / TO pipeline
  notes: string[];
  unknown: string[];
}

function pickMaterialToken(tokens: string[], mem: NeoMemory | null): { id: string; word: string } | null {
  // Learned words win (Neo remembers what you meant last time).
  if (mem) {
    for (const t of tokens) {
      const v = mem.resolve("material", t);
      if (v && MATERIALS[v]) return { id: v, word: t };
    }
  }
  const keys = Object.keys(MATERIALS).sort((a, b) => b.length - a.length);
  for (const t of tokens) {
    for (const k of keys) {
      if (t === k || t === MATERIALS[k].name.toLowerCase()) return { id: k, word: t };
    }
    if (MAT_ALIAS[t]) return { id: MAT_ALIAS[t], word: t };
    for (const k of keys) {
      const nm = MATERIALS[k].name.toLowerCase();
      if (nm.includes(t) && t.length >= 4) return { id: k, word: t };
    }
  }
  // Fuzzy: tolerate typos ("coper" → copper).
  for (const t of tokens) {
    if (t.length < 5 || STOPWORDS.has(t)) continue;
    let best = "", bestD = 3;
    for (const k of keys) {
      const d = Math.min(levenshtein(t, k), levenshtein(t, MATERIALS[k].name.toLowerCase().split(" ")[0]));
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best && bestD <= 2) return { id: best, word: t };
  }
  return null;
}

function pickFluidToken(tokens: string[]): { id: string; word: string } | null {
  for (const t of tokens) {
    if (FLUIDS[t]) return { id: t, word: t };
    if (FLUID_ALIAS[t] && FLUIDS[FLUID_ALIAS[t]]) return { id: FLUID_ALIAS[t], word: t };
  }
  for (const t of tokens) {
    for (const k of Object.keys(FLUIDS)) {
      if (FLUIDS[k].name.toLowerCase().includes(t) && t.length >= 4) return { id: k, word: t };
    }
  }
  return null;
}

function pickShapeToken(tokens: string[], mem: NeoMemory | null): { shape: "box" | "sphere"; word: string } | null {
  if (mem) {
    for (const t of tokens) {
      const v = mem.resolve("shape", t);
      if (v === "box" || v === "sphere") return { shape: v, word: t };
    }
  }
  for (const t of tokens) {
    for (const s of SHAPES) if (s.words.includes(t)) return { shape: s.shape, word: t };
  }
  return null;
}

function pickActionToken(tokens: string[], raw: string, mem: NeoMemory | null): { action: NeoAction; word: string } | null {
  if (mem) {
    for (const t of tokens) {
      const v = mem.resolve("verb", t);
      if (v && (VERBS as Record<string, string[]>)[v]) return { action: v as NeoAction, word: t };
    }
  }
  for (const t of tokens) {
    for (const [action, verbs] of Object.entries(VERBS)) {
      if (verbs.includes(t)) return { action: action as NeoAction, word: t };
    }
  }
  if (tokens.includes("laser") || tokens.includes("lase")) return { action: "lase", word: "laser" };
  if (tokens.includes(FIRE_WORD) || /\bfire\b/.test(raw)) {
    // Disambiguate by context: ballistics vs thermal.
    const ballistic = /m\/s|degrees|°|at |into |onto |from |throw|shoot|launch/.test(raw);
    return ballistic ? { action: "throw", word: "fire" } : { action: "burn", word: "fire" };
  }
  if (/\bblow up\b/.test(raw)) return { action: "blast", word: "blow up" };
  if (/\bset fire\b/.test(raw)) return { action: "burn", word: "set fire" };
  return null;
}

/** Parse a sentence into a NeoPlan. Pure function of (input, memory). */
export function neoParse(input: string, mem: NeoMemory | null = null): NeoPlan {
  const raw = input.toLowerCase();
  const tokens = raw.replace(/[^a-z0-9°/.\s-]/g, " ").split(/[\s-]+/).filter(Boolean);

  const act = pickActionToken(tokens, raw, mem);
  const action = act?.action ?? null;
  const shapeHit = pickShapeToken(tokens, mem);
  const matHit = pickMaterialToken(tokens, mem);
  const fluidHit = pickFluidToken(tokens);

  // Planet picker (same rule as experience()).
  let planet = "earth";
  for (const k of Object.keys(PLANETS)) {
    if (tokens.includes(k)) { planet = k; break; }
  }

  // Numbers with units, in string order.
  const nums: { value: number; unit: string; index: number }[] = [];
  const numRe = /(\d+(?:\.\d+)?)\s?(mm|cm|km|m\/s|°c|degrees|°|ft|in|m)\b/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(raw))) {
    nums.push({ value: parseFloat(m[1]), unit: m[2], index: m.index });
  }
  const tempHit = nums.find((n) => n.unit === "°c") ?? null;
  const velHit = nums.find((n) => n.unit === "m/s") ?? null;
  const angHit = nums.find((n) => n.unit === "degrees" || n.unit === "°") ?? null;
  const lengths = nums.filter((n) => !["°c", "m/s", "degrees", "°"].includes(n.unit));

  // Altitude ("at 8000m altitude") thins the air for ballistics.
  const altHit = raw.match(/altitude\s(\d+(?:\.\d+)?)\s?m/) ?? raw.match(/at\s(\d+(?:\.\d+)?)\s?m\saltitude/);
  const altitudeM = altHit ? parseFloat(altHit[1]) : null;

  // Corrosive target ("dissolve steel in battery acid").
  let acid: string | null = null;
  for (const [phrase, id] of Object.entries(ACID_ALIAS)) {
    if (raw.includes(phrase)) { acid = id; break; }
  }

  const idxOf = (words: string[]): number[] =>
    words.flatMap((w) => {
      const out: number[] = [];
      const re = new RegExp(`\\b${escRe(w)}\\b`, "g");
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(raw))) out.push(mm.index);
      return out;
    });
  const shapeIdx = shapeHit ? idxOf([shapeHit.word]) : [];
  const heightIdx = idxOf(HEIGHT_CUES);
  const sizeIdx = [...shapeIdx, ...idxOf(SIZE_CUES)];

  let sizeM = 0.5, heightM: number | null = null;
  const used = new Set<number>();
  const near = (pos: number, cues: number[], within: number): boolean =>
    cues.some((c) => Math.abs(pos - c) <= within && pos >= c - 4);

  for (const [i, L] of lengths.entries()) {
    if (near(L.index, heightIdx, 16)) { if (heightM === null) { heightM = L.value * unitToM(L.unit); used.add(i); } }
    else if (near(L.index, sizeIdx, 14)) { if (sizeM === 0.5 && !used.has(i)) { sizeM = L.value * unitToM(L.unit); used.add(i); } }
  }
  const rest = lengths.filter((_, i) => !used.has(i));
  const ballistic = action === "drop" || action === "throw" || action === "crush" || action === "blast";
  if (heightM === null && rest.length && (ballistic || action === "float" || action === "sink")) {
    heightM = rest[0].value * unitToM(rest[0].unit);
    rest.shift();
  }
  if (sizeM === 0.5 && rest.length && !ballistic) {
    sizeM = rest[0].value * unitToM(rest[0].unit);
    rest.shift();
  }
  sizeM = Math.min(3, Math.max(0.05, sizeM));
  if (heightM !== null) heightM = Math.min(400, Math.max(0.5, heightM));
  else if (ballistic) heightM = action === "throw" ? 10 : 12;
  else if (action === "float" || action === "sink") heightM = 5;

  // Target: fluid wins when named; ground words or default otherwise.
  let target: NeoTarget = { kind: "ground", word: "ground" };
  if (fluidHit) target = { kind: "fluid", fluid: fluidHit.id, word: fluidHit.word };
  else {
    const g = tokens.find((t) => GROUND_WORDS.includes(t));
    if (g) target = { kind: "ground", word: g };
    else if (action === "float" || action === "sink" || action === "pour") {
      target = { kind: "fluid", fluid: "water", word: "water" };
    }
  }

  const material = matHit?.id ?? (action === "pour" && fluidHit ? "water" : "oak");
  const notes: string[] = [];
  if (!act) notes.push("no action word found — Neo needs a verb like throw, melt, crush.");
  if (!matHit && action !== "pour") notes.push("no material named — assuming oak; say copper, glass, lead…");
  if (!shapeHit) notes.push("no shape named — assuming cube; say cube, sphere, ball…");
  if (rest.length) notes.push(`extra number(s) ignored: ${rest.map((r) => `${r.value}${r.unit}`).join(", ")}`);

  // Unknown tokens: candidates for learning (not stopwords, not matched).
  const matched = new Set([
    act?.word, shapeHit?.word, matHit?.word, fluidHit?.word,
    ...(target.kind === "ground" && target.word !== "ground" ? [target.word] : []),
    planet !== "earth" ? planet : "",
  ]);
  const unknown = tokens.filter((t) =>
    !STOPWORDS.has(t) && !KNOWN_EXTRA.has(t) && t.length > 2 && !matched.has(t) &&
    !/^\d/.test(t) && !["mm", "cm", "km", "ft", "in", "m", "c", "s", "ms"].includes(t));

  // Confidence: filled slots over needed slots, minus unknown-word penalty.
  const need = [act ? 1 : 0, matHit ? 1 : 0, shapeHit ? 1 : 0,
    (heightM !== null || tempHit || velHit) ? 1 : 0,
    (fluidHit || target.word !== "ground") ? 1 : 0, planet !== "earth" ? 1 : 0];
  const filled = need.reduce((a, b) => a + b, 0);
  const confidence = Math.min(0.95, Math.max(0.3, 0.35 + filled * 0.12 - unknown.length * 0.04));

  const mat = MATERIALS[material];
  const shapeWord = shapeHit?.word ?? "cube";
  const shape = shapeHit?.shape ?? "box";
  const objStr = `${mat.name} ${shape} (${(mat.density * (shape === "sphere"
    ? (4 / 3) * Math.PI * sizeM ** 3 : (2 * sizeM) ** 3)).toFixed(0)} kg, ${sizeM} m)`;
  const fromBits: string[] = [];
  if (heightM !== null) fromBits.push(`${heightM} m up`);
  if (velHit) fromBits.push(`${velHit.value} m/s`);
  else if (action === "throw") fromBits.push("6 m/s @ 25°");
  if (angHit) fromBits.push(`@ ${angHit.value}°`);
  if (tempHit) fromBits.push(`${tempHit.value}°C`);
  if (altitudeM !== null) fromBits.push(`at ${altitudeM} m altitude (thin air)`);
  const toStr = action === "dissolve" && acid
    ? `${acid} bath → corrosion timeline verdict`
    : target.kind === "fluid"
    ? `${FLUIDS[target.fluid!].name} pool → splash → ${mat.density < (FLUIDS[target.fluid!].density ?? 1e9) ? "float" : "sink"}`
    : "solid ground → impact vs strength";
  const steps: [string, string][] = [
    ["WHAT", act ? `${action} (“${act.word}”)` : "—"],
    ["OBJECT", objStr],
    ["FROM", fromBits.length ? fromBits.join(", ") : action === "melt" || action === "burn" || action === "boil" ? "heat chamber (pre-heated)" : "placed in the world"],
    ["TO", toStr],
  ];

  return {
    action, actionWord: act?.word ?? "", shape, shapeWord,
    material, materialWord: matHit?.word ?? "",
    sizeM, heightM,
    velMs: velHit ? velHit.value : action === "throw" ? 6 : null,
    angleDeg: angHit ? angHit.value : action === "throw" ? 25 : null,
    tempC: tempHit ? tempHit.value : null,
    pourFluid: action === "pour" ? (fluidHit?.id ?? "water") : null,
    acid, altitudeM,
    target, planet, confidence, steps, notes, unknown,
  };
}

// ------------------------------------------------- sentence-space + dataset

/** How many distinct sentence structures Neo's grammar covers. */
export function neoPatternCount(): { total: number; breakdown: Record<string, number> } {
  const verbs = Object.values(VERBS).reduce((a, v) => a + v.length, 0) + 3; // + fire/blow up/set fire
  const shapes = SHAPES.reduce((a, s) => a + s.words.length, 0);
  const materials = Object.keys(MATERIALS).length + Object.keys(MAT_ALIAS).length;
  const sizeU = SIZE_UNITS.length;
  const heightU = SIZE_UNITS.length;
  const targets = 1 + Object.keys(FLUIDS).length + Object.keys(FLUID_ALIAS).length + GROUND_WORDS.length;
  const planets = Object.keys(PLANETS).length;
  const breakdown = { verbs, shapes, materials, sizeU, heightU, targets, planets };
  const total = verbs * shapes * materials * sizeU * heightU * targets * planets;
  return { total, breakdown };
}

/** Deterministic sample sentences from Neo's grammar (seeded — same seed, same lines). */
export function neoSamples(seed: number, n: number): string[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const verbs = Object.values(VERBS).flat();
  const shapes = SHAPES.flatMap((s) => s.words);
  const mats = [...Object.keys(MATERIALS), ...Object.keys(MAT_ALIAS)];
  const targets = [...Object.keys(FLUIDS), ...Object.keys(FLUID_ALIAS), "ground"];
  const su = SIZE_UNITS.map(([u]) => u);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i % 3;
    if (t === 0) {
      out.push(`${pick(verbs)} a ${(rnd() * 9 + 0.1).toFixed(1)}${pick(su)} ${pick(mats)} ${pick(shapes)} from ${(rnd() * 190 + 5).toFixed(0)}m in the ${pick(targets)}`);
    } else if (t === 1) {
      out.push(`${pick(verbs)} the ${pick(mats)} ${pick(shapes)} in ${pick(targets)}`);
    } else {
      out.push(`does ${pick(mats)} melt at ${(rnd() * 1500 - 100).toFixed(0)}C`);
    }
  }
  return out;
}

// ------------------------------------------------- memory (learns locally)

/** Minimal key/value store so the engine stays DOM-free; the frontend passes localStorage. */
export interface NeoStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

export interface NeoMemoryJSON {
  version: 1;
  runs: number;
  aliases: Record<string, { slot: "verb" | "material" | "shape"; value: string; hits: number }>;
  unknownWords: Record<string, number>;
  history: { input: string; action: string; material: string }[];
}

const MEM_KEY = "neo-memory-v1";

export class NeoMemory {
  runs = 0;
  aliases: NeoMemoryJSON["aliases"] = {};
  unknownWords: Record<string, number> = {};
  history: NeoMemoryJSON["history"] = [];

  /** A learned word overrides the grammar only after it proved itself (hits ≥ 2). */
  resolve(slot: "verb" | "material" | "shape", token: string): string | null {
    const a = this.aliases[token];
    return a && a.slot === slot && a.hits >= 2 ? a.value : null;
  }

  /** Learn from one conversation turn: reinforce what parsed, log what didn't. */
  learn(input: string, plan: NeoPlan): void {
    this.runs++;
    const bump = (slot: "verb" | "material" | "shape", word: string, value: string) => {
      if (!word) return;
      const k = word.toLowerCase();
      const cur = this.aliases[k];
      if (cur && cur.slot === slot && cur.value === value) cur.hits++;
      else if (!cur) this.aliases[k] = { slot, value, hits: 1 };
    };
    if (plan.action) bump("verb", plan.actionWord, plan.action);
    if (plan.materialWord) bump("material", plan.materialWord, plan.material);
    if (plan.shapeWord && plan.shapeWord !== "cube") bump("shape", plan.shapeWord, plan.shape);
    for (const u of plan.unknown) this.unknownWords[u] = (this.unknownWords[u] ?? 0) + 1;
    this.history.push({ input: input.slice(0, 140), action: plan.action ?? "?", material: plan.material });
    if (this.history.length > 50) this.history = this.history.slice(-50);
  }

  stats(): { runs: number; words: number; unknown: number } {
    const words = Object.values(this.aliases).filter((a) => a.hits >= 2).length;
    return { runs: this.runs, words, unknown: Object.keys(this.unknownWords).length };
  }

  toJSON(): NeoMemoryJSON {
    return { version: 1, runs: this.runs, aliases: this.aliases, unknownWords: this.unknownWords, history: this.history };
  }

  static load(store: NeoStore): NeoMemory {
    const m = new NeoMemory();
    try {
      const raw = store.getItem(MEM_KEY);
      if (!raw) return m;
      const j = JSON.parse(raw) as NeoMemoryJSON;
      if (j.version !== 1) return m;
      m.runs = j.runs; m.aliases = j.aliases; m.unknownWords = j.unknownWords; m.history = j.history;
    } catch { /* corrupt memory → fresh brain, game still runs */ }
    return m;
  }

  save(store: NeoStore): void {
    try { store.setItem(MEM_KEY, JSON.stringify(this.toJSON())); } catch { /* private mode — learn in-memory only */ }
  }
}

// ------------------------------------------------- plan → engine scenario

/** Which engine tool answers this plan (shown in UI so Neo's choice is inspectable). */
export function neoToolFor(plan: NeoPlan): { tool: string; why: string } {
  switch (plan.action) {
    case "melt": case "burn": case "freeze": case "boil": case "scratch":
      return { tool: "verdict", why: "closed-form thresholds (melt point, ignition, Mohs) — no sim needed" };
    case "electrify":
      return { tool: "verdict", why: "conductivity vs breakdown voltage — closed form" };
    case "dissolve":
      return { tool: "verdict", why: "acid corrosion timeline — table lookup" };
    case "lase":
      return { tool: "verdict", why: "Snell refraction — closed form" };
    case "roll":
      return { tool: "verdict", why: "rolling-resistance stop distance — closed form" };
    case "float": case "sink": case "pour":
      return { tool: "scenario", why: "fluid sim: buoyancy + viscosity integrated at 120 Hz" };
    default:
      return { tool: "scenario", why: "rigid-body sim: gravity, drag, impact stress at 120 Hz" };
  }
}

/** Actions judged by closed-form experience() instead of a drop scenario. */
export function neoNeedsExperience(plan: NeoPlan): boolean {
  return plan.action === "electrify" || plan.action === "dissolve"
    || plan.action === "lase" || plan.action === "roll";
}

/** Build the deterministic scenario this plan stages + judges (one parse, one truth). */
export function neoScenario(plan: NeoPlan): ScenarioDesc {
  const mat = MATERIALS[plan.material];
  const bodies: NonNullable<ScenarioDesc["bodies"]> = [];
  const checks: NonNullable<ScenarioDesc["checks"]> = [];
  const H = plan.heightM ?? 10;
  switch (plan.action) {
    case "throw":
      bodies.push({
        shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: H,
        vel: [
          (plan.velMs ?? 6) * Math.cos(((plan.angleDeg ?? 25) * Math.PI) / 180),
          (plan.velMs ?? 6) * Math.sin(((plan.angleDeg ?? 25) * Math.PI) / 180), 0,
        ],
        dragProfile: plan.shape === "sphere" ? "sphere" : "cube",
      });
      checks.push({ kind: "survives-fall", heightM: H });
      break;
    case "crush":
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 2 });
      bodies.push({ shape: "box", material: "steel", sizeM: 1.5, heightM: H });
      checks.push({ kind: "survives-fall", heightM: H });
      break;
    case "blast":
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 30, vel: [0, -25, 0] });
      checks.push({ kind: "survives-fall", heightM: 30 });
      break;
    case "slide":
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: plan.sizeM, vel: [8, 0, 0] });
      break;
    case "build":
      bodies.push(
        { shape: "box", material: plan.material, sizeM: plan.sizeM, heightM: plan.sizeM },
        { shape: "box", material: plan.material, sizeM: plan.sizeM, heightM: plan.sizeM * 3 },
        { shape: "box", material: plan.material, sizeM: plan.sizeM, heightM: plan.sizeM * 5 },
      );
      break;
    case "scratch":
      bodies.push({ shape: "box", material: plan.material, sizeM: plan.sizeM, heightM: 2 });
      if (mat.mohs !== undefined) checks.push({ kind: "scratch", tool: plan.material, target: "quartz" });
      break;
    case "melt": case "burn": case "boil": {
      const demo = plan.tempC ?? mat.meltC ?? mat.ignitionC ?? 500;
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 1, tempC: demo + 50 });
      checks.push({ kind: "melt-at", tempC: demo + 50 });
      break;
    }
    case "freeze":
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 1, tempC: -30 });
      break;
    case "float": case "sink": case "pour": {
      const fluid = plan.target.kind === "fluid" ? plan.target.fluid! : "water";
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: H });
      checks.push({ kind: "floats-in", fluid });
      break;
    }
    default:
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: H });
      checks.push({ kind: "survives-fall", heightM: H });
  }
  return {
    env: plan.planet, durationS: 10, bodies, checks,
    ...(plan.altitudeM !== null ? { airDensity: altitudeDensity(plan.altitudeM) } : {}),
  };
}
