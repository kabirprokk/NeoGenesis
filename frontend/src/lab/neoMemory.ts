// EpisodicMemory — Neo's layered memory hierarchy, 100% local.
//
//  Sensory working buffer: the last 20 moments (ring). Flushed by design —
//  holding everything would grow localStorage without bound and slow the
//  sampler with stale context.
//  Episodic long-term memory: only significant moments (high intensity,
//  explicit "remember", staged experiments), capped at 50 slots by importance.
//  Each episode is a compressed record — tags + VAD point + one-line note —
//  not a transcript, so this is a summary store, not a vector database
//  (no embeddings, no server, nothing to query but counts and recency).
//  Self-reflection: when idle, Neo replays long-term tags and forms
//  generalizations ONLY from repeated, valence-consistent experience
//  (a tag seen ≥2 times with the same valence sign). Nothing is asserted
//  from a single event — one storm does not make a belief.
export interface Episode {
  t: number; kind: "talk" | "experiment" | "explicit" | "event";
  tags: string[]; valence: number; arousal: number; intensity: number; note: string;
  reward: number;
}

export type AssocStrength = "critical" | "caution" | "safe" | "comfort";
export interface Generalization { tag: string; rule: string; support: number; meanValence: number; strength: AssocStrength }

const WORKING_CAP = 20;
const LTM_CAP = 50;
const RULE_CAP = 6;

export const tagOf = (text: string): string[] => {
  const t = text.toLowerCase();
  const tags: string[] = [];
  const has = (...ws: string[]): boolean => ws.some((w) => t.includes(w));
  if (has("storm", "lightning", "thunder")) tags.push("storm");
  if (has("lava", "molten", "burn", "fire", "heat", "melt")) tags.push("heat");
  if (has("rain", "drizzle", "wet")) tags.push("rain");
  if (has("night", "dark", "midnight", "moon")) tags.push("night");
  if (has("water", "swim", "pool", "ocean", "lake")) tags.push("water");
  if (has("sun", "sunny", "noon", "bright")) tags.push("sun");
  if (has("snow", "ice", "freez", "cold", "winter")) tags.push("cold");
  if (has("throw", "drop", "crash", "smash", "blast", "explode")) tags.push("impact");
  if (has("float", "sink", "buoy")) tags.push("water");
  if (has("name is", "call me", "remember")) tags.push("bonding");
  return [...new Set(tags)].slice(0, 3);
};

export class EpisodicMemory {
  buffer: Episode[] = [];
  longTerm: Episode[] = [];
  generalizations: Generalization[] = [];
  /** Dopamine ledger: learned value per tag (approach +, avoid −). TD-style. */
  values: Record<string, { v: number; n: number }> = {};

  record(e: Episode): void {
    this.buffer.push(e);
    if (this.buffer.length > WORKING_CAP) this.buffer.splice(0, this.buffer.length - WORKING_CAP);
    if (e.intensity >= 0.55 || e.kind === "explicit" || e.kind === "experiment") {
      this.longTerm.push(e);
      this.longTerm.sort((a, b) => b.intensity - a.intensity);
      if (this.longTerm.length > LTM_CAP) this.longTerm.length = LTM_CAP;
    }
    if (e.reward !== 0) this.reward(e.tags, e.reward);
  }

  /** Reinforcement: shift each tag's value toward the felt reward. */
  reward(tags: string[], r: number, alpha = 0.25): void {
    for (const t of tags) {
      const cur = this.values[t] ?? { v: 0, n: 0 };
      cur.v += alpha * (Math.max(-1, Math.min(1, r)) - cur.v);
      cur.n++;
      this.values[t] = cur;
    }
  }

  valueOf(tag: string): number { return this.values[tag]?.v ?? 0; }

  /** Habit familiarity: how many long-term episodes carry this tag. */
  familiarity(tag: string): number {
    return this.longTerm.filter((e) => e.tags.includes(tag)).length;
  }

  fears(): string[] {
    return Object.entries(this.values).filter(([, s]) => s.v < -0.3).map(([t]) => t);
  }

  comforts(): string[] {
    return Object.entries(this.values).filter(([, s]) => s.v > 0.3).map(([t]) => t);
  }

  /** Idle self-reflection: replay tags, keep only repeated + valence-consistent beliefs. */
  reflect(): Generalization[] {
    const byTag = new Map<string, Episode[]>();
    for (const e of this.longTerm) for (const t of e.tags) {
      if (!byTag.has(t)) byTag.set(t, []);
      (byTag.get(t) as Episode[]).push(e);
    }
    const fresh: Generalization[] = [];
    for (const [tag, eps] of byTag) {
      if (eps.length < 2) continue;
      const meanV = eps.reduce((s, e) => s + e.valence, 0) / eps.length;
      if (Math.abs(meanV) < 0.12) continue; // mixed feelings — no belief formed
      const sign = meanV > 0 ? 1 : -1;
      if (!eps.every((e) => e.valence * sign > -0.05)) continue;
      if (this.generalizations.some((g) => g.tag === tag)) continue;
      const val = this.valueOf(tag);
      const strength: AssocStrength = meanV <= -0.3 || val <= -0.3
        ? (eps.length >= 3 ? "critical" : "caution")
        : (eps.length >= 3 ? "comfort" : "safe");
      const rule = strength === "critical"
        ? `${tag} is danger to me — I steer clear when it comes around`
        : strength === "caution"
          ? `${tag} unsettles me — I stay wary when it comes around`
          : strength === "comfort"
            ? `${tag} steadies me — I settle whenever it comes around`
            : `${tag} feels safe — I am easy when it comes around`;
      fresh.push({ tag, rule, support: eps.length, meanValence: Math.round(meanV * 100) / 100, strength });
    }
    fresh.sort((a, b) => b.support - a.support);
    for (const g of fresh.slice(0, RULE_CAP - this.generalizations.length)) this.generalizations.push(g);
    if (this.generalizations.length > RULE_CAP) this.generalizations.length = RULE_CAP;
    return fresh;
  }

  ruleFor(text: string): Generalization | null {
    const t = text.toLowerCase();
    return this.generalizations.find((g) => t.includes(g.tag)) ?? null;
  }

  toJSON(): { buffer: Episode[]; longTerm: Episode[]; generalizations: Generalization[]; values: Record<string, { v: number; n: number }> } {
    return { buffer: this.buffer.slice(-WORKING_CAP), longTerm: this.longTerm, generalizations: this.generalizations, values: this.values };
  }

  static fromJSON(j: { buffer?: Episode[]; longTerm?: Episode[]; generalizations?: Generalization[]; values?: Record<string, { v: number; n: number }> }): EpisodicMemory {
    const m = new EpisodicMemory();
    m.buffer = (j.buffer ?? []).slice(-WORKING_CAP);
    m.longTerm = (j.longTerm ?? []).slice(0, LTM_CAP);
    m.generalizations = (j.generalizations ?? []).slice(0, RULE_CAP);
    m.values = j.values ?? {};
    // Backfill reward on legacy episodes (persisted before the ledger existed).
    for (const e of [...m.buffer, ...m.longTerm]) if (typeof (e as Episode).reward !== "number") (e as Episode).reward = 0;
    return m;
  }
}
