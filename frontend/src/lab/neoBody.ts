// NeoBody — Neo's feeling pipeline, in TypeScript (the game runs 100% in the
// browser; there is no Python runtime, and the engine stays dependency-free).
//
// Three stages, mirroring the idea behind the proposal but built from live
// local numbers instead of external datasets:
//
//  1. Interoception — virtual biometrics (heart rate, respiration, skin
//     conductance proxy, SpO2) driven by the senses Neo actually has
//     (air temp, storm, night, water, nearby heat) through documented
//     human-inspired response curves. Homeostasis pulls everything back
//     toward baseline, so Neo calms down — nothing here is recorded
//     physiology (no PhysioNet/MIMIC data is ingested; those banks are
//     credentialed, human-subject data and orders of magnitude too large).
//  2. Exteroception — environment context classified from live world state
//     (storm, rain, night, lava heat, water, staged bodies). Honest and
//     narrow: Neo reports the world it inhabits, not Places-style vision
//     (10M images + a vision backbone cannot ship in this game).
//  3. Affect — a CONTINUOUS 3D emotional vector space (valence × arousal ×
//     dominance, after Russell/Plutchik-style dimensional models): every tick
//     moves one point in that space, and the mood word is read off wherever
//     the point currently sits — infinite blends, no rigid labels. A second
//     nearby point in the same space yields the undertone
//     ("tense with a thread of alertness"). The lexicon is a small hand-built
//     dimensional map, NOT GoEmotions/IEMOCAP data (both need gated access,
//     licensing review, and heavy pipelines no browser game can carry).
export interface BodyInput {
  tempC: number; rainMmH: number; storm: boolean; windMs: number;
  night: boolean; inWater: boolean; nearHeat: boolean; cloud01: number;
}

export interface BodyState {
  heartBpm: number; respPerMin: number; eda01: number; spo2: number;
  shiver: boolean; arousal01: number; valence: number; dominance01: number;
  intensity01: number; mood: string; undertone: string; context: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Dimensional affect map with NO hard boundaries: the lexicon is a set of
 * prototype points in VAD space and the mood is whichever prototype the live
 * point sits nearest to. Move the point a hair and the word can flip — blends
 * are infinite and continuous, exactly the claim. Storm/shiver stay as
 * overriding biological reflexes, not moods.
 */
const PROTOTYPES: { w: string; v: number; a: number; d: number }[] = [
  { w: "overwhelmed", v: -0.7, a: 0.8, d: 0.2 },
  { w: "tense", v: -0.4, a: 0.7, d: 0.4 },
  { w: "storm-tense", v: -0.5, a: 0.75, d: 0.45 },
  { w: "defiant", v: -0.4, a: 0.7, d: 0.85 },
  { w: "energized", v: 0.6, a: 0.8, d: 0.6 },
  { w: "alert", v: 0.2, a: 0.55, d: 0.6 },
  { w: "uneasy", v: -0.35, a: 0.5, d: 0.5 },
  { w: "small", v: -0.3, a: 0.5, d: 0.2 },
  { w: "restless", v: -0.25, a: 0.4, d: 0.5 },
  { w: "content", v: 0.45, a: 0.35, d: 0.6 },
  { w: "steady", v: 0.1, a: 0.35, d: 0.6 },
  { w: "calm", v: 0.4, a: 0.2, d: 0.6 },
  { w: "assured", v: 0.4, a: 0.2, d: 0.85 },
  { w: "sluggish", v: -0.3, a: 0.15, d: 0.5 },
  { w: "adrift", v: -0.3, a: 0.2, d: 0.25 },
];

const dist2 = (v: number, a: number, d: number, p: { v: number; a: number; d: number }): number =>
  (v - p.v) * (v - p.v) + (a - p.a) * (a - p.a) + 0.7 * (d - p.d) * (d - p.d);

function nearestMoods(arousal: number, valence: number, dominance: number): [string, string] {
  const ranked = PROTOTYPES.map((p) => ({ w: p.w, d: dist2(valence, arousal, dominance, p) }))
    .sort((x, y) => x.d - y.d);
  return [ranked[0].w, ranked[1].w];
}

/** Public read-off for injected (scientist-overridden) states. */
export function readMoods(arousal: number, valence: number, dominance: number): [string, string] {
  return nearestMoods(
    Math.min(1, Math.max(0, arousal)),
    Math.min(1, Math.max(-1, valence)),
    Math.min(1, Math.max(0, dominance)));
}

function moodFor(arousal: number, valence: number, dominance: number, shiver: boolean, storm: boolean): string {
  if (shiver) return "shivery";
  if (storm && arousal > 0.6 && dominance < 0.4) return "overwhelmed";
  if (storm && arousal > 0.6) return "storm-tense";
  return nearestMoods(arousal, valence, dominance)[0];
}

function contextFor(i: BodyInput, bodyCount: number): string {
  if (i.storm) return "in a storm";
  if (i.nearHeat) return "beside scorching heat";
  if (i.inWater) return "standing in water";
  if (i.rainMmH > 0.5) return i.night ? "in night rain" : "in the rain";
  if (i.night) return bodyCount > 0 ? "on the night plane among staged bodies" : "on the night plane";
  if (i.cloud01 > 0.6) return "under overcast sky";
  return bodyCount > 0 ? "on the open plane among staged bodies" : "on the open plane";
}

export class NeoBody {
  private s: BodyState = {
    heartBpm: 70, respPerMin: 14, eda01: 0.2, spo2: 98.5,
    shiver: false, arousal01: 0.3, valence: 0.2, dominance01: 0.6,
    intensity01: 0.3, mood: "steady", undertone: "steady", context: "on the open plane",
  };

  /** Target biometrics from the current senses (before smoothing). */
  static targets(i: BodyInput, mastery01: number): { hr: number; rr: number; eda: number; arousal: number; valence: number; dominance: number; shiver: boolean } {
    const heat = Math.max(0, i.tempC - 35);
    const cold = Math.max(0, 5 - i.tempC);
    let hr = 70 + Math.min(25, heat * 2.2) + Math.min(15, cold * 1.2);
    let arousal = 0.3;
    let dominance = 0.6 + mastery01 * 0.2; // learning steadily builds Neo's sense of control
    if (i.storm) { hr += 8; arousal += 0.35; dominance -= 0.25; }
    else if (i.rainMmH > 0.1) { hr += 3; arousal += 0.12; dominance -= 0.05; }
    hr += Math.min(4, i.windMs * 0.3);
    if (i.night) { hr -= 4; arousal -= 0.15; dominance -= 0.05; }
    if (i.inWater && i.tempC < 12) { hr += 6; arousal += 0.2; dominance -= 0.1; }
    if (i.nearHeat) { hr += 10; arousal += 0.3; dominance -= 0.1; }
    const rr = 14 + (hr - 70) * 0.18;
    const eda = clamp(0.2 + arousal * 0.5 + heat * 0.02, 0, 1);
    // Valence: comfort band is mildly positive; extremes pull negative.
    let valence = 0.25;
    valence -= Math.min(0.6, heat * 0.06 + cold * 0.05);
    if (i.storm) valence -= 0.25;
    if (!i.night && i.rainMmH <= 0.1 && heat === 0 && cold === 0) valence += 0.15;
    if (i.nearHeat) valence -= 0.2;
    return { hr, rr, eda, arousal: clamp(arousal, 0, 1), valence: clamp(valence, -1, 1), dominance: clamp(dominance, 0, 1), shiver: i.tempC < 2 };
  }

  /** Advance toward the targets — homeostasis, called each tick. */
  update(i: BodyInput, dt: number, bodyCount: number, mastery01 = 0): BodyState {
    const t = NeoBody.targets(i, mastery01);
    const k = Math.min(1, dt * 0.6);
    const s = this.s;
    s.heartBpm += (t.hr - s.heartBpm) * k;
    s.respPerMin += (t.rr - s.respPerMin) * k;
    s.eda01 += (t.eda - s.eda01) * k;
    s.arousal01 += (t.arousal - s.arousal01) * k;
    s.valence += (t.valence - s.valence) * k;
    s.dominance01 += (t.dominance - s.dominance01) * k;
    s.spo2 = 98.5;
    s.shiver = t.shiver;
    s.intensity01 = clamp(0.5 * s.arousal01 + 0.3 * Math.abs(s.valence) + 0.2 * (1 - s.dominance01), 0, 1);
    s.mood = moodFor(s.arousal01, s.valence, s.dominance01, s.shiver, i.storm);
    // Undertone: the SECOND-nearest prototype — the blend neither word owns.
    const [, second] = nearestMoods(s.arousal01 * 0.85, s.valence * 0.85, s.dominance01);
    s.undertone = second;
    if (s.undertone === s.mood || s.intensity01 < 0.45) s.undertone = "";
    s.context = contextFor(i, bodyCount);
    return this.snapshot();
  }

  snapshot(): BodyState {
    return { ...this.s };
  }

  /**
   * Dopamine signal from a bodily shift: positive when Neo settles toward
   * baseline (found shade, storm passed), negative when distress spikes.
   * Explicit pain (heart > 110) punishes hard; calm rest rewards.
   */
  static rewardSignal(prev: BodyState, curr: BodyState): number {
    const distressOf = (s: BodyState): number =>
      (Math.abs(s.heartBpm - 70) / 30) * 0.6 + s.arousal01 * 0.3 - s.valence * 0.3;
    let r = distressOf(prev) - distressOf(curr);
    if (curr.heartBpm > 110) r -= 0.5;
    if (curr.heartBpm < 78 && curr.valence > 0.2) r += 0.15;
    return Math.max(-1, Math.min(1, Math.round(r * 100) / 100));
  }
}

/** Biometric delta gate: skip recompute unless the world moved enough. */
export function bodyInputChanged(a: BodyInput | null, b: BodyInput): boolean {
  if (!a) return true;
  return (
    Math.abs(a.tempC - b.tempC) > 1.5 ||
    Math.abs(a.rainMmH - b.rainMmH) > 0.5 ||
    a.storm !== b.storm ||
    Math.abs(a.windMs - b.windMs) > 2 ||
    a.night !== b.night ||
    a.inWater !== b.inWater ||
    a.nearHeat !== b.nearHeat ||
    Math.abs(a.cloud01 - b.cloud01) > 0.2
  );
}

export interface InjectorState {
  /** Null = natural. Set = scientist override (panic/fatigue testing). */
  hrBpm: number | null; tempDeltaC: number;
  arousalDelta: number; valenceDelta: number; dominanceDelta: number;
}

export const freshInjector = (): InjectorState => ({
  hrBpm: null, tempDeltaC: 0, arousalDelta: 0, valenceDelta: 0, dominanceDelta: 0,
});

export const injectorActive = (j: InjectorState): boolean =>
  j.hrBpm !== null || j.tempDeltaC !== 0 || j.arousalDelta !== 0 || j.valenceDelta !== 0 || j.dominanceDelta !== 0;

/**
 * Scientist override applied AFTER the natural update: the injector does not
 * fake the world, it clamps Neo's felt state — exactly like your slide-to-
 * 180-BPM test. Synthetic by construction, labeled wherever shown.
 */
export function applyInjector(s: BodyState, j: InjectorState): BodyState {
  if (!injectorActive(j)) return s;
  const n = { ...s };
  if (j.hrBpm !== null) {
    n.heartBpm = Math.min(200, Math.max(35, j.hrBpm));
    n.respPerMin = 14 + (n.heartBpm - 70) * 0.18;
  }
  n.arousal01 = clamp(n.arousal01 + j.arousalDelta, 0, 1);
  n.valence = clamp(n.valence + j.valenceDelta, -1, 1);
  n.dominance01 = clamp(n.dominance01 + j.dominanceDelta, 0, 1);
  const [mood, under] = readMoods(n.arousal01, n.valence, n.dominance01);
  n.mood = n.shiver ? n.mood : mood;
  n.undertone = under === n.mood ? "" : under;
  n.intensity01 = clamp(0.5 * n.arousal01 + 0.3 * Math.abs(n.valence) + 0.2 * (1 - n.dominance01), 0, 1);
  return n;
}
