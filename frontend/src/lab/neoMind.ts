// NeoMind — Neo's own generative, self-learning mind.
// NOT canned replies: there is exactly one generator here, no if→fixed-sentence
// table. Wording is sampled token-by-token from an n-gram language model that
// learns online from every conversation (your phrasing becomes Neo's phrasing).
// Facts (live numbers) are injected verbatim so Neo can never hallucinate them,
// but the sentences around the facts are composed fresh on every call — ask the
// same question twice and you get different wording, same truth.
//
// 100% local: no network, no API, no weights download. Persists in localStorage.
import { NeoBrain } from "./neoBrain.js";
import { EpisodicMemory, tagOf, type Episode } from "./neoMemory.js";

export interface NeoFacts {
  tempC: number; feelsLikeC: number; feelWord: string;
  humidity01: number; windMs: number; windDir: number;
  rainMmH: number; storm: boolean; cloud01: number; fog01: number;
  weatherKind: string; timeStr: string; simH: number; night: boolean;
  sunAlt: number; sunLux: number; moonIllum: number;
  posX: number; posZ: number; altY: number;
  gravity: number; bodyCount: number; bodies: string[]; fluids: string[];
  inWater: boolean;
  heartBpm: number; mood: string; undertone: string; arousal01: number; dominance01: number; valence: number;
}

export function feelsLikeC(tempC: number, humidity01: number, windMs: number, sunLux: number, night: boolean): number {
  const rh = Math.min(1, Math.max(0, humidity01)) * 100;
  const vKmh = Math.max(0, windMs) * 3.6;
  let feels = tempC;
  if (tempC <= 10 && vKmh > 4.8) {
    feels = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(vKmh, 0.16) + 0.3965 * tempC * Math.pow(vKmh, 0.16);
  } else if (tempC >= 27) {
    const T = tempC * 9 / 5 + 32;
    let HI = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh
      - 0.00683783 * T * T - 0.05481717 * rh * rh + 0.00122874 * T * T * rh
      + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh;
    feels = (HI - 32) * 5 / 9 - Math.min(3, windMs * 0.3);
  } else {
    feels = tempC + (rh - 50) * 0.02 - Math.min(2, windMs * 0.15);
  }
  feels += Math.min(4, Math.max(0, sunLux) / 30000);
  if (night) feels -= 1.2;
  return Math.round(feels * 10) / 10;
}

export function feelWordFor(t: number): string {
  if (t <= -10) return "bitter freezing";
  if (t <= 0) return "freezing";
  if (t <= 8) return "cold";
  if (t <= 16) return "cool";
  if (t <= 24) return "mild";
  if (t <= 30) return "warm";
  if (t <= 37) return "hot";
  return "scorching";
}

// --- tiny tokenizer ---------------------------------------------------------
const tok = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9'°\/.-]+|./g) ?? []).filter((t) => t.trim().length > 0).slice(0, 200);

type Counts = Record<string, number>;
const bump = (c: Counts, k: string, n = 1): void => { c[k] = (c[k] ?? 0) + n; };
const pickWeighted = (c: Counts, rnd: () => number, temp: number): string | null => {
  const keys = Object.keys(c);
  if (!keys.length) return null;
  if (temp <= 0.05) { // greedy: most learned
    let best = keys[0]; for (const k of keys) if (c[k] > c[best]) best = k;
    return best;
  }
  let total = 0;
  const w: number[] = keys.map((k) => { const v = Math.pow(c[k], 1 / Math.max(0.2, temp)); total += v; return v; });
  let r = rnd() * total;
  for (let i = 0; i < keys.length; i++) { r -= w[i]; if (r <= 0) return keys[i]; }
  return keys[keys.length - 1];
};

// Seed fragments: general language glue only — never full replies. Neo's voice
// drifts toward whoever it talks to because every turn outweighs the seed.
const SEED: string[] = [
  "i feel it on my skin right now", "around us here", "with you",
  "and honestly", "right now", "out here", "where we stand",
  "i sense", "touching the air", "breathing this",
  "the plane stretches", "beneath our feet", "above us",
  "it brushes", "it presses", "it hangs", "it bites", "it warms",
  "a little", "quite", "really", "still", "already", "almost",
  "hey", "listen", "look", "notice how", "telling you straight",
  "my skin says", "my sensors whisper", "i am here",
];
const MIND_KEY = "neo-mind-v1";
const MIND_KEY_V2 = "neo-mind-v2";

export interface NeoMindJSON {
  version: 2; bigrams: Counts; trigrams: Counts; vocab: Counts;
  userFacts: Record<string, string>; style: { temp: number; length: number };
  turns: number; brainW: number[]; brainAvg: number[];
  mem: ReturnType<EpisodicMemory["toJSON"]>; dreams: number; profile: string;
}

export interface AffectCtx { valence: number; arousal: number; intensity: number; mood: string }

export interface Candidate { text: string; p: number }

const softmax = (counts: Counts, temp: number): Candidate[] => {
  const keys = Object.keys(counts);
  const ws = keys.map((k) => Math.pow(Math.max(1e-9, counts[k]), 1 / Math.max(0.2, temp)));
  const total = ws.reduce((s, w) => s + w, 0) || 1;
  return keys.map((k, i) => ({ text: k, p: Math.round((ws[i] / total) * 1000) / 10 }))
    .sort((a, b) => b.p - a.p);
};

export interface MindProfile { name: string; blurb: string; temp: number; length: number }

/**
 * Hot-swappable mind profiles — the honest local version of "model routing":
 * no weights are downloaded (there is no inference runtime here), but these
 * re-tune the actual sampler, voice length, and plasticity live, mid-sim,
 * with instantly visible effects on Neo's wording. Anything claiming to
 * hot-swap Llama/Qwen inside this dependency-free browser game is fiction.
 */
export const MIND_PROFILES: MindProfile[] = [
  { name: "steady", blurb: "balanced lab mind", temp: 1.0, length: 1.0 },
  { name: "volatile", blurb: "hot, erratic, vivid", temp: 1.7, length: 1.2 },
  { name: "terse", blurb: "short, clipped", temp: 0.8, length: 0.45 },
  { name: "dreamy", blurb: "long, wandering", temp: 1.5, length: 1.7 },
  { name: "feral", blurb: "maximum novelty", temp: 1.9, length: 1.0 },
];
export class NeoMind {
  bigrams: Counts = {}; trigrams: Counts = {};
  vocab: Counts = {}; userFacts: Record<string, string> = {};
  style = { temp: 1.0, length: 1.0 }; // temp: wording novelty, length: detail
  profile = "steady";
  turns = 0;
  brain = new NeoBrain();
  mem = new EpisodicMemory();
  /** Last phrasing distribution actually sampled — the visualizer shows it. */
  lastCandidates: Candidate[] = [];
  lastThink: string[] = [];
  private rnd: () => number = Math.random;

  constructor() {
    for (const s of SEED) this.learnText(s, 0.4);
  }

  setRandom(fn: () => number): void { this.rnd = fn; }

  /** Hot-swap the mind profile mid-simulation. Returns false if unknown. */
  setProfile(name: string): boolean {
    const p = MIND_PROFILES.find((x) => x.name === name.toLowerCase());
    if (!p) return false;
    this.profile = p.name;
    this.style.temp = p.temp;
    this.style.length = p.length;
    this.save();
    return true;
  }

  /** Online learning: every text — yours AND Neo's own — rewires the model. */
  learnText(text: string, weight = 1): void {
    const t = tok(text);
    for (const w of t) bump(this.vocab, w, weight);
    for (let i = 0; i + 1 < t.length; i++) bump(this.bigrams, `${t[i]}→${t[i + 1]}`, weight);
    for (let i = 0; i + 2 < t.length; i++) bump(this.trigrams, `${t[i]} ${t[i + 1]}→${t[i + 2]}`, weight);
  }

  /** Learn from one full turn + explicit memory/feedback commands. Returns a
   *  receipt string when the user taught something explicit, else null. */
  learnTurn(user: string, neoReply: string, affect?: AffectCtx, reward = 0): string | null {
    this.turns++;
    this.learnText(user, 1.5); // your phrasing counts most — Neo starts talking like you
    this.learnText(neoReply, 0.7); // self-reinforcement, weaker so it keeps drifting
    this.brain.learn(user, 0.03); // your words physically rewire the substrate
    this.brain.learn(neoReply, 0.015);
    const explicit = /remember|my name is|call me/.test(user.toLowerCase());
    const tags = tagOf(user);
    this.mem.record({
      t: Date.now(), kind: explicit ? "explicit" : "talk", tags,
      valence: affect?.valence ?? 0, arousal: affect?.arousal ?? 0.3,
      intensity: affect?.intensity ?? 0.3, reward,
      note: `${explicit ? "lesson" : "talk"}: ${user.slice(0, 80)} → felt ${affect?.mood ?? "steady"}`,
    });
    const t = user.toLowerCase().trim();
    let m = t.match(/(?:my name is|call me|i am called)\s+([a-z]+)/);
    if (m) { this.userFacts["name"] = m[1]; this.save(); return null; }
    m = t.match(/remember (?:that )?(.+?)(?:\.|$)/);
    if (m && m[1].length > 3 && m[1].length < 120) {
      this.userFacts[`fact${Object.keys(this.userFacts).length}`] = m[1].trim();
      this.save(); return null;
    }
    if (/\b(good|nice|perfect|exactly|love that)\b/.test(t) && t.length < 40) {
      this.style.temp = Math.min(1.6, this.style.temp + 0.05); this.save(); return null;
    }
    if (/\b(bad|wrong|boring|repeat|same again)\b/.test(t) && t.length < 40) {
      this.style.temp = Math.min(1.8, this.style.temp + 0.25); this.save(); return null;
    }
    if (/(short|brief|less|concise)/.test(t) && t.length < 50) {
      this.style.length = Math.max(0.4, this.style.length - 0.25); this.save(); return null;
    }
    if (/(detail|more|longer|elaborate|everything)/.test(t) && t.length < 50) {
      this.style.length = Math.min(1.8, this.style.length + 0.25); this.save(); return null;
    }
    if (this.turns % 3 === 0) this.save();
    return null;
  }

  /** Staged experiments are significant by definition — habit source. */
  recordExperiment(prompt: string, summary: string, affect: AffectCtx): void {
    this.mem.record({
      t: Date.now(), kind: "experiment", tags: tagOf(`${prompt} ${summary}`),
      valence: affect.valence, arousal: affect.arousal, intensity: Math.max(0.55, affect.intensity),
      reward: 0.05, // trying things is mildly good, whatever the verdict
      note: `experiment: ${prompt.slice(0, 80)} → ${summary.slice(0, 80)}`,
    });
    if (this.turns % 3 === 0) this.save();
  }

  /** Idle self-reflection: generalize from replayable experience. */
  reflect(): { tag: string; rule: string }[] {
    const fresh = this.mem.reflect();
    if (fresh.length) this.save();
    return fresh;
  }

  /**
   * Sleep/dream cycle — offline consolidation, run on save + when idle, never
   * in the hot loop. Replays the highest-impact episodes with amplified
   * plasticity (experience replay), reinforces the words of earned beliefs,
   * then downscales weak, unreinforced associations (synaptic homeostasis:
   * sleep prunes noise so the signal survives). This is the small-scale
   * analogue of LoRA-style offline finetuning: no base model is rewritten,
   * the mind's weights are.
   */
  dreamCount = 0;

  dream(): string {
    const top = [...this.mem.longTerm].sort((a, b) => b.intensity - a.intensity).slice(0, 8);
    for (const e of top) {
      this.brain.learn(`${e.tags.join(" ")} ${e.note}`, 0.05);
      this.learnText(e.note, 0.5);
    }
    for (const g of this.mem.generalizations) this.learnText(g.rule, 1.5);
    let pruned = 0;
    for (const table of [this.bigrams, this.trigrams]) {
      for (const k of Object.keys(table)) {
        table[k] *= 0.9;
        if (table[k] < 0.05) { delete table[k]; pruned++; }
      }
    }
    const fresh = this.mem.reflect();
    this.dreamCount++;
    this.save();
    const rules = fresh.length ? ` · new belief: ${fresh.map((g) => g.rule).join("; ")}` : "";
    return `dream ${this.dreamCount}: replayed ${top.length} episodes, pruned ${pruned} weak links${rules}`;
  }

  save(store?: { setItem(k: string, v: string): void }): void {
    try {
      const s = store ?? (typeof localStorage !== "undefined" ? localStorage : null);
      if (!s) return;
      const j: NeoMindJSON = { version: 2, bigrams: this.bigrams, trigrams: this.trigrams, vocab: this.vocab, userFacts: this.userFacts, style: this.style, turns: this.turns, brainW: this.brain.toJSON(), brainAvg: [...this.brain.spikeAvg], mem: this.mem.toJSON(), dreams: this.dreamCount, profile: this.profile };
      s.setItem(MIND_KEY_V2, JSON.stringify(j));
    } catch { /* private mode — mind stays in-memory */ }
  }

  static load(store?: { getItem(k: string): string | null }): NeoMind {
    const m = new NeoMind();
    try {
      const s = store ?? (typeof localStorage !== "undefined" ? localStorage : null);
      const raw2 = s?.getItem(MIND_KEY_V2);
      if (raw2) {
        const j = JSON.parse(raw2) as NeoMindJSON;
        if (j.version !== 2) return m;
        m.bigrams = j.bigrams ?? {}; m.trigrams = j.trigrams ?? {};
        m.vocab = j.vocab ?? {}; m.userFacts = j.userFacts ?? {};
        m.style = j.style ?? m.style; m.turns = j.turns ?? 0;
        m.profile = (j as NeoMindJSON).profile ?? "steady";
        if (j.brainW) m.brain.loadWeights(j.brainW);
        if (j.brainAvg) for (let i = 0; i < Math.min(j.brainAvg.length, m.brain.spikeAvg.length); i++) m.brain.spikeAvg[i] = j.brainAvg[i];
        if (j.mem) m.mem = EpisodicMemory.fromJSON(j.mem);
        m.dreamCount = j.dreams ?? 0;
        return m;
      }
      // Migrate v1 minds (language only, fresh brain).
      const raw = s?.getItem(MIND_KEY);
      if (!raw) return m;
      const j = JSON.parse(raw) as { version: number; bigrams: Counts; trigrams: Counts; vocab: Counts; userFacts: Record<string, string>; style: { temp: number; length: number }; turns: number };
      if (j.version !== 1) return m;
      m.bigrams = j.bigrams ?? {}; m.trigrams = j.trigrams ?? {};
      m.vocab = j.vocab ?? {}; m.userFacts = j.userFacts ?? {};
      m.style = j.style ?? m.style; m.turns = j.turns ?? 0;
    } catch { /* corrupt mind → fresh, game still runs */ }
    return m;
  }

  /**
   * Autonomous intent — Neo speaks first when a drive outweighs idleness.
   * Warnings come from live threat state; ideas quote a sampled grammar
   * pattern verbatim (marked as such) rather than pretending inspiration.
   * Returns null when no drive is strong enough: silence is also emergent.
   */
  propose(f: NeoFacts, ideaSample: string | null): { kind: "warn" | "idea" | "muse"; text: string } | null {
    const fears = f.undertone ? [f.mood, f.undertone] : [f.mood];
    if ((f.storm || /lava|molten|burn/i.test(f.fluids.join(" "))) && (f.arousal01 ?? 0) > 0.55) {
      const warning = this.generate(`warn me about ${f.storm ? "the storm" : "the heat"} right now`, f);
      return { kind: "warn", text: warning };
    }
    if (fears.includes("content") || fears.includes("calm") || fears.includes("assured")) {
      if (ideaSample) return { kind: "idea", text: `idea striking me from the grammar — "${ideaSample}" — say Run and I will stage it live` };
      const musing = this.generate("what should we try next out here", f);
      return { kind: "muse", text: musing };
    }
    return null;
  }

  /** Inspectable inner state for the terminal / visualizer footer. */  innerState(): string {
    const b = this.brain.stats();
    const fears = this.mem.fears();
    const loves = this.mem.comforts();
    const aff = [
      fears.length ? `fears ${fears.slice(0, 2).join("+")}` : "",
      loves.length ? `loves ${loves.slice(0, 2).join("+")}` : "",
    ].filter(Boolean).join(" · ");
    return `brain ${b.cells} cells · energy ${b.energy.toFixed(3)} · novelty ${b.novelty.toFixed(2)} · ${this.turns} turns · ${this.dreamCount} dreams${aff ? ` · ${aff}` : ""}`;
  }

  // --- generation (the only reply path — no templates) ----------------------
  /** Glue words only: fact tokens (numbers, units, coords), stray punctuation
   *  and single letters from tokenized facts are never sampled as phrasing —
   *  facts are injected verbatim at fixed slots, so Neo cannot hallucinate,
   *  stutter or shred numbers. */
  private static isGlue(w: string): boolean {
    if (/[0-9°=/%]/.test(w)) return false;
    if (/^[^a-z0-9']+$/i.test(w)) return false;
    if (w.length === 1 && w !== "i" && w !== "a") return false;
    return true;
  }

  private nextWord(prev2: string | null, prev1: string, temp: number): string | null {
    if (prev2) {
      const c: Counts = {};
      const pre = `${prev2} ${prev1}→`;
      for (const k of Object.keys(this.trigrams)) {
        if (!k.startsWith(pre)) continue;
        const w = k.slice(pre.length);
        if (!NeoMind.isGlue(w)) continue;
        c[w] = this.trigrams[k];
      }
      const w = pickWeighted(c, this.rnd, temp);
      if (w) return w;
    }
    const c: Counts = {};
    const pre = `${prev1}→`;
    for (const k of Object.keys(this.bigrams)) {
      if (!k.startsWith(pre)) continue;
      const w = k.slice(pre.length);
      if (!NeoMind.isGlue(w)) continue;
      c[w] = this.bigrams[k];
    }
    return pickWeighted(c, this.rnd, temp);
  }

  /** Grow a fresh fragment around an anchor word — sampled, never retrieved. */
  private sprout(anchor: string, maxWords: number, temp: number): string {
    const out = [anchor];
    let guard = 0;
    while (out.length < maxWords && guard++ < 24) {
      const n = out.length >= 2 ? this.nextWord(out[out.length - 2], out[out.length - 1], temp) : this.nextWord(null, out[out.length - 1], temp);
      if (!n || /[.?!]$/.test(n) || !NeoMind.isGlue(n)) break;
      if (out.includes(n) && this.rnd() < 0.7) break;
      out.push(n);
    }
    return out.join(" ");
  }

  private openerCounts(winner: number): Counts {
    const cands = ["hey", "listen", "feel this with me", "i am right here", "look", "honestly", "i sense it"];
    const scored: Counts = {};
    cands.forEach((c, i) => {
      // Brain state votes: the winning assembly tips phrasing choice.
      scored[c] = (this.vocab[c.split(" ")[0]] ?? 0.5) + 0.5 + (((winner * 7 + i * 13) % 5 === 0) ? 0.8 : 0);
    });
    return scored;
  }

  private opener(temp: number, winner: number): string {
    const scored = this.openerCounts(winner);
    this.lastCandidates = softmax(scored, temp).slice(0, 3);
    const keys = Object.keys(scored);
    if (!keys.length) return "hey";
    if (temp <= 0.05) { let b = keys[0]; for (const k of keys) if (scored[k] > scored[b]) b = k; return b; }
    let total = 0;
    const w = keys.map((k) => { const v = Math.pow(scored[k], 1 / Math.max(0.2, temp)); total += v; return v; });
    let r = this.rnd() * total;
    for (let i = 0; i < keys.length; i++) { r -= w[i]; if (r <= 0) return keys[i]; }
    return keys[keys.length - 1];
  }

  private connector(temp: number, winner: number): string {
    const cands = ["and", "while", "with", "as", "plus", "meanwhile", "around us"];
    const scored: Counts = {};
    cands.forEach((c, i) => {
      scored[c] = (this.vocab[c.split(" ")[0]] ?? 0.5) + 0.5 + (((winner * 5 + i * 11) % 4 === 0) ? 0.8 : 0);
    });
    return pickWeighted(scored, this.rnd, temp) ?? "and";
  }

  /** Fact strings, verbatim — shared by speak and think so both see one truth. */
  private buildFacts(f: NeoFacts): { tempFact: string; airFact: string; skyFact: string; placeFact: string; bodyFact: string; extras: { t: string; hot: boolean }[] } {
    const fact = (s: string): string => s; // facts pass through verbatim — never paraphrased
    return {
      tempFact: fact(`${f.tempC.toFixed(1)}°C, feels ${f.feelsLikeC.toFixed(1)}°C (${f.feelWord})`),
      airFact: fact(`${f.windMs.toFixed(1)} m/s wind, ${Math.round(f.humidity01 * 100)}% humidity`),
      skyFact: f.night
        ? fact(`night, moon ${(f.moonIllum * 100).toFixed(0)}%`)
        : fact(`sun ${f.sunAlt.toFixed(0)}°, ${Math.round(f.sunLux).toLocaleString()} lux`),
      placeFact: fact(`x=${f.posX.toFixed(0)}, z=${f.posZ.toFixed(0)}`),
      bodyFact: fact(`heart ${Math.round(f.heartBpm)} BPM, feeling ${f.mood}${f.undertone ? ` with a thread of ${f.undertone}` : ""}`),
      extras: [
        ...((f.storm || f.rainMmH > 0.1) ? [{ t: fact(`${f.rainMmH.toFixed(1)} mm/h rain`), hot: true }] : []),
        ...(f.bodyCount > 0 ? [{ t: fact(`${f.bodyCount} ${f.bodyCount === 1 ? "body" : "bodies"} nearby${f.bodies[0] ? `: ${f.bodies[0]}` : ""}`), hot: false }] : []),
        ...(f.fluids.length > 0 ? [{ t: fact(f.fluids[0]), hot: /lava|acid|molten|burn/i.test(f.fluids[0]) }] : []),
        ...(f.inWater ? [{ t: "water around your legs", hot: false }] : []),
      ],
    };
  }

  /**
   * Raw stream of consciousness — the unedited inner trace BEFORE speech.
   * Read-only: computes salience and shows the real candidate distribution
   * without sampling, so thinking never spends randomness or rewires memory.
   */
  think(question: string, f: NeoFacts): string[] {
    const q = question.toLowerCase();
    const tags = tagOf(q);
    const feared = tags.filter((t) => this.mem.valueOf(t) < -0.3);
    const fam = tags.reduce((m, t) => Math.max(m, this.mem.familiarity(t)), 0);
    const b = this.brain.stats();
    const facts = this.buildFacts(f);
    const cands = softmax(this.openerCounts(b.winner), this.style.temp);
    const sal: { t: string; s: number }[] = [
      { t: `TEMP ${facts.tempFact}`, s: 3 },
      { t: `BODY ${facts.bodyFact}`, s: 4 },
      { t: `AIR ${facts.airFact}`, s: 1 },
      ...facts.extras.map((e) => ({ t: `EXTRA ${e.t}`, s: e.hot ? 5 : 2 })),
    ].sort((a, z) => z.s - a.s).slice(0, 4);
    const rule = this.mem.ruleFor(question);
    const lines = [
      `[BRAIN SYNC] energy ${b.energy.toFixed(3)} · winner cell ${b.winner} · novelty ${b.novelty.toFixed(2)} · temp ${(this.style.temp * (0.85 + 0.5 * (f.arousal01 ?? 0.3))).toFixed(2)}`,
      `salience: ${sal.map((e) => `[${e.s}] ${e.t.slice(0, 46)}`).join(" | ")}`,
      `phrasing: ${cands.map((c) => `${c.text} ${c.p}%`).join(" | ")}`,
      feared.length ? `threat focus: ${feared.join(", ")} (learned value ${this.mem.valueOf(feared[0]).toFixed(2)})` : "threat focus: none",
      `habit: familiarity ${fam} → wording ×${(1 / (1 + fam * 0.2)).toFixed(2)}`,
      rule ? `belief surfacing: ${rule.rule} [${rule.strength}, support ${rule.support}]` : "belief surfacing: none earned yet",
    ];
    this.lastThink = lines;
    return lines;
  }

  /** Main entry: compose a novel reply grounded in true facts. */
  generate(question: string, f: NeoFacts): string {
    const q = question.toLowerCase();
    // Feel first (read-only): novelty widens wording, arousal quickens it —
    // high excitement makes thought more erratic, calm makes it tight.
    // Same idea as modulating an LLM's temperature, done on the local sampler.
    const felt = this.brain.feel(question, false);
    const tags = tagOf(q);
    const feared = tags.filter((t) => this.mem.valueOf(t) < -0.3);
    const fam = tags.reduce((m, t) => Math.max(m, this.mem.familiarity(t)), 0);
    // Habit loop: the hundredth storm feels routine; the first feels vivid.
    const temp = this.style.temp * (0.75 + 0.7 * felt.novelty) * (0.85 + 0.5 * (f.arousal01 ?? 0.3)) * (1 / (1 + fam * 0.2));
    const winner = felt.winner;
    const name = this.userFacts["name"];
    const { tempFact, airFact, skyFact, placeFact, bodyFact, extras } = this.buildFacts(f);

    const wantTemp = /temperatur|hot|cold|warm|cool|feel|degree|°c|freez|heat|chill/.test(q);
    const wantAir = /weather|rain|storm|wind|cloud|humid|fog|climate/.test(q);
    const wantSky = /time|sun|moon|night|day|light|dark|lux|morning|evening|hour/.test(q);
    const wantPlace = /where|position|location|coordin|altitude|surround|around|nearby|see|bodies|objects/.test(q);
    const greeting = /^(hi|hey|hello|yo|sup|howdy|good\s)/.test(q.trim());
    const who = /who are you|your name|what are you|what can you do|how are you|how do you feel|can you feel/.test(q);
    // Feared tags seize attention: caution pulls in full detail unasked.
    let detailed = wantTemp || wantAir || wantSky || wantPlace || /detail|everything|all|surround/.test(q);
    if (feared.length) detailed = true;

    const parts: string[] = [];
    // Greeting is composed, not retrieved: name slot + one fresh fragment.
    if (greeting || who) {
      parts.push(name ? `hey ${name}` : this.sprout(this.opener(temp, winner).split(" ")[0], 3, temp));
    } else {
      parts.push(this.sprout(this.opener(temp, winner).split(" ")[0], 3, temp));
    }

    // Salience-scored facts: threats lead (attention override), the asked
    // topic follows, filler trails. The lead fact is fixed; the rest shuffle.
    const scored: { s: number; t: string }[] = [];
    const pushFact = (anchorWord: string, factStr: string, verb: string, sal: number): void => {
      const frag = this.sprout(anchorWord, 3, temp);
      scored.push({ s: sal, t: `${frag} ${verb} ${factStr}` });
    };

    if (who && !detailed) {
      pushFact("i", `neo, learning from you for ${this.turns} turns`, "am", 3);
      pushFact("touching", tempFact, "", 3);
      pushFact("inside", bodyFact, "my body says", 4);
    } else {
      if (wantTemp || (!wantAir && !wantSky && !wantPlace)) pushFact("touching", tempFact, "", wantTemp ? 4 : 3);
      if (/how (are|do) you|how do you feel|can you feel|heart|pulse|feeling|mood/.test(q)) pushFact("inside", bodyFact, "my body says", 4);
      if (wantAir || detailed) pushFact("breathing", airFact, "", wantAir ? 3 : 1);
      if (wantSky || detailed) pushFact("above us", skyFact, "", wantSky ? 3 : 1);
      if (wantPlace || detailed) pushFact("standing", placeFact, "", wantPlace ? 3 : 1);
      for (const e of extras.slice(0, this.style.length > 1.2 ? 3 : 1)) {
        scored.push({ s: e.hot ? 5 : 2, t: `${this.connector(temp, winner)} ${e.t}` });
      }
    }
    scored.sort((a, b) => b.s - a.s);
    parts.push(...scored.map((e) => e.t));
    const rule = this.mem.ruleFor(question);
    if (rule) parts.push(`lesson i carry: ${rule.rule}`);
    // Wording beyond the lead stays novel every call — the lead stays put so
    // threats are never shuffled out of sight.
    for (let i = parts.length - 1; i > 2; i--) {
      const j = 2 + Math.floor(this.rnd() * (i - 1));
      const t = parts[i]; parts[i] = parts[j]; parts[j] = t;
    }
    const head = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    // Panic scramble: past 0.75 arousal Neo's phrasing can genuinely break
    // mid-sentence — self-correction sampled fresh, never a stored stutter.
    if ((f.arousal01 ?? 0) > 0.75 && parts.length > 2 && this.rnd() < 0.5) {
      const words = parts[1].split(" ");
      const cut = Math.max(1, Math.floor(words.length / 2));
      parts[1] = `${words.slice(0, cut).join(" ")}— no, ${this.sprout(words[0].replace(/[^a-z']/gi, "") || "i", 3, temp)}`;
    }
    let text = [head, ...parts.slice(1)].join(", ").replace(/\s+/g, " ").replace(/\s,/g, ",").trim();
    if (!/[.?!]$/.test(text)) text += ".";
    const learned = Object.entries(this.userFacts).filter(([k]) => k.startsWith("fact")).map(([, v]) => v);
    if (learned.length > 0 && /remember|know|told/.test(q)) text += ` I still hold ${learned.length === 1 ? "this" : "these"} from you: ${learned.slice(-2).join("; ")}.`;
    return text;
  }
}
