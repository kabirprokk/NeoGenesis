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
import { MATERIALS, FLUIDS, MOHS_LADDER, explosiveClass, EXPLOSIVES, FRICTION_PAIRS } from "./materials.js";
import { PLANETS } from "./planets.js";
import { EngineWorld } from "./world.js";
import {
  terminalVelocity, humanTerminal, projectileRange,
  mohsVerdict, buoyancyVerdict, soundDelay, lightDelay, slidesOnIncline,
  electroVerdict, corrosionVerdict, snellBend, rollingStop, doseAt, toxicityTier, fallSurvival,
  heatEnergyJ, meltEnergyKJ, heatTimeS, lorentz, relKineticJ,
  orbitVelocity, escapeVelocity, orbitPeriodS, horizonM,
  soundSpeed, gravityAt, blackbodyFlux,
} from "./physics.js";
import { ELECTRICAL, ACIDS, CORROSION_MIN, IMMUNE_MIN, OPTICS, ROLLING, ISOTOPES, GASTOX, HUMAN, FALL_ODDS, SPECIFIC_HEAT, EMISSIVITY, UNCERTAINTY, H_CONV, altitudeDensity } from "./science.js";
import { CODEX_VERSION } from "./constants.js";

export type Verdict = "REAL" | "NOT REAL" | "MIXED";
export interface TraceSample { t: number; y: number; v: number; tempC: number; event?: string }
export interface ExperienceResult {
  id: string; codex: string; verdict: Verdict; confidence: number;
  prompt: string; environment: string;
  measurements: Record<string, number | string | boolean | unknown[]>;
  uncertainty: Record<string, string>; // every key number above gets an error bar here
  citations: string[]; // CITATIONS ids backing this verdict — `citations` tool renders BibTeX
  trace: TraceSample[]; traces?: Record<string, TraceSample[]>;
  events: string[]; reasons: string[];
}
export interface ScenarioDesc {
  env?: string; gravity?: number; ambientC?: number; airDensity?: number;
  wind?: [number, number, number]; durationS?: number;
  bodies?: { shape?: "sphere" | "box"; material?: string; sizeM?: number; heightM?: number; vel?: [number, number, number]; tempC?: number; dragProfile?: string; ghost?: boolean; massKg?: number; x?: number; static?: boolean; fillFrac?: number; cargoOf?: number; spin?: [number, number, number] }[];
  checks?: ({ kind: "survives-fall"; heightM: number; body?: number } | { kind: "floats-in"; fluid: string; body?: number } | { kind: "scratch"; tool: string; target: string; body?: number } | { kind: "melt-at"; tempC: number; body?: number } | { kind: "hear-at"; distM: number; mediumMs?: number } | { kind: "lands-first" } | { kind: "clears-wall"; wall?: number; body?: number })[];
  /** Conditional branch marker: bodies[ifBody] is the condition, bodies[thenBody] the consequent. */
  branch?: { ifBody: number; thenBody: number };
}

const reason = (r: ExperienceResult, v: Verdict, c: number, text: string) => {
  r.reasons.push(text);
  if (v === "NOT REAL") { r.verdict = "NOT REAL"; r.confidence = Math.max(r.confidence, c); }
  else if (v === "MIXED" && r.verdict === "REAL") { r.verdict = "MIXED"; r.confidence = Math.max(r.confidence, c); }
  else if (v === "REAL") r.confidence = Math.max(r.confidence, c);
};
const fresh = (prompt: string, env: string): ExperienceResult => ({
  id: `EXP-${String(++expCounter).padStart(4, "0")}`,
  codex: CODEX_VERSION,
  verdict: "REAL", confidence: 0, prompt, environment: env,
  measurements: {}, uncertainty: {}, citations: [], trace: [], events: [], reasons: [],
});
let expCounter = 0;

/** Attach an error bar: ±rel fraction rendered in engineering units. */
const unc = (r: ExperienceResult, key: string, value: number, rel: number, why: string) => {
  const plus = value * rel;
  const fmt = (v: number): string => Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(3);
  r.uncertainty[key] = `±${fmt(plus)} (±${(rel * 100).toFixed(0)}%: ${why})`;
};
/** Cite a reference family exactly once. */
const cite = (r: ExperienceResult, ...ids: string[]) => {
  for (const id of ids) if (!r.citations.includes(id)) r.citations.push(id);
};

/** Time-series trace as CSV (all bodies when simulated). Paste straight into a spreadsheet. */
export function verdictCSV(r: ExperienceResult): string {
  const series = r.traces ?? { body0: r.trace };
  const names = Object.keys(series);
  const rows = [`experiment,id,t_s,body,y_m,v_ms,tempC,event`];
  for (const b of names) {
    for (const s of series[b]) {
      rows.push([`"${r.prompt.slice(0, 60).replace(/"/g, "")}"`, r.id, s.t, b, s.y, s.v, s.tempC, `"${(s.event ?? "").replace(/"/g, "")}"`].join(","));
    }
  }
  return rows.join("\n");
}
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

  // 0a. CONDITIONALS — "if the glass breaks, drop steel": two setups, one branch.
  // The condition sims first; the consequent is judged as the live branch only
  // when the break happens, otherwise as its own staged setup.
  {
    const cm = p.match(/^\s*if\s+(.+?)(?:,?\s*\bthen\b\s+|,\s*)(.+)$/);
    if (cm && cm[1].length > 2 && cm[2].length > 2) {
      const ifR = experience(cm[1]);
      const thenR = experience(cm[2]);
      const broken = ifR.measurements.broken === true
        || ifR.events.join(" ").includes("SHATTER")
        || ifR.reasons.join(" ").includes("SHATTERED");
      thenR.prompt = input;
      thenR.environment = envName;
      thenR.measurements = { ...thenR.measurements, conditionMet: broken, conditionPrompt: cm[1].slice(0, 80) };
      cite(thenR, "nist", "isa");
      if (broken) {
        thenR.reasons.unshift(`IF TRUE: "${cm[1].slice(0, 70)}" breaks — branch taken, consequent judged live below.`);
      } else {
        thenR.reasons.unshift(`IF FALSE: "${cm[1].slice(0, 70)}" holds — consequent never triggers; judged as its own staged setup.`);
      }
      return thenR;
    }
  }

  // 0b. LANDING-ORDER RACES — "drop steel and glass, tell me who lands first".
  // Two named materials fall side by side (6 m lanes, no interaction); touchdown
  // times rank the verdict. Needs two materials, else MIXED with the gap named.
  if (/\bwho\s+(lands|hits|falls|reaches)\s+first\b|\bwhich\s+lands\s+first\b|\blanding\s+order\b|\btell\s+me\s+who\b/.test(p)) {
    const order: { idx: number; id: string }[] = [];
    for (const k of Object.keys(MATERIALS)) {
      const nm = MATERIALS[k].name.toLowerCase();
      let i = p.indexOf(k);
      while (i !== -1) { order.push({ idx: i, id: k }); i = p.indexOf(k, i + 1); }
      if (nm !== k) {
        let j = p.indexOf(nm);
        while (j !== -1) { order.push({ idx: j, id: k }); j = p.indexOf(nm, j + 1); }
      }
    }
    order.sort((a, b) => a.idx - b.idx);
    const ids: string[] = [];
    for (const o of order) if (!ids.includes(o.id)) ids.push(o.id);
    if (ids.length < 2) {
      const r = fresh(input, envName);
      reason(r, "MIXED", 0.4, "A race needs two named materials: 'drop steel and glass — who lands first'.");
      return r;
    }
    const hM = p.match(/(\d+(?:\.\d+)?)\s?(km|m|ft)\b/);
    const h = hM ? parseFloat(hM[1]) * (hM[2] === "km" ? 1000 : hM[2] === "ft" ? 0.3048 : 1) : 50;
    return runScenario(input, {
      env: planet.id, durationS: 12,
      bodies: [
        { shape: "box", material: ids[0], sizeM: 0.5, heightM: h, x: 0 },
        { shape: "box", material: ids[1], sizeM: 0.5, heightM: h, x: 6 },
      ],
      checks: [
        { kind: "survives-fall", heightM: h, body: 0 },
        { kind: "survives-fall", heightM: h, body: 1 },
        { kind: "lands-first" },
      ],
    });
  }

  // 1. LIFT verdicts — human strength is bounded and well documented.
  const liftM = p.match(/lift|carry|hold|pick up/);
  const kgM = p.match(/(\d+(?:\.\d+)?)\s?kg/);
  if (liftM && kgM) {
    const kg = parseFloat(kgM[1]);
    const r = fresh(input, envName);
    const gL = planet.gravity / PHYSICS.G_EARTH;
    r.measurements = { massKg: kg, weightN: +(kg * planet.gravity).toFixed(1), earthEquivalentKg: +(kg * gL).toFixed(1), deadliftLimitKg: HUMAN.deadliftKg.value, carryComfortKg: HUMAN.carryKg.value };
    cite(r, "osha");
    unc(r, "deadliftLimitKg", HUMAN.deadliftKg.value, UNCERTAINTY.liftLimit.rel!, "athlete spread");
    if (kg * gL > HUMAN.deadliftKg.value) reason(r, "NOT REAL", 0.97, `No human lifts ${kg} kg at ${planet.gravity} m/s² — absolute spinal-failure limit is ${HUMAN.deadliftKg.value} kg on Earth.`);
    else if (kg * gL > 250) reason(r, "MIXED", 0.75, `Only world-record lifters move ${kg} kg-equivalent. Ordinary human: NOT REAL.`);
    else if (kg * gL > HUMAN.carryKg.value) reason(r, "REAL", 0.85, `${kg} kg is liftable but past the ${HUMAN.carryKg.value} kg comfort limit — no running, stamina drains 3×.`);
    else reason(r, "REAL", 0.9, `${kg} kg is within comfortable carry capacity (force ${(kg * planet.gravity).toFixed(0)} N).`);
    return r;
  }

  // 2. MELT / BURN verdicts. Bare "degrees/degree" default to °C (science convention).
  const tempM = p.match(/(-?\d+(?:\.\d+)?)\s?(?:°?c|degrees?|deg)\b/);
  if (/melt|burn|ignite|heat|freeze|boil|fire|lava/.test(p) && tempM) {
    const T = parseFloat(tempM[1]);
    const r = fresh(input, envName);
    const th = SPECIFIC_HEAT[matId];
    const warmKJ = th ? +(heatEnergyJ(1, th.c, T - 20) / 1000).toFixed(1) : "unknown";
    const meltKJ = th && mat.meltC !== undefined ? +meltEnergyKJ(th.c, mat.meltC, 20, th.lf).toFixed(1) : "unknown";
    // Lumped-capacitance time for 1 kg (sphere) to approach the bath temperature.
    let heatS: number | string = "unknown", heatHow = "still room air (h=10 W/m²·K)";
    if (th) {
      const rad = Math.cbrt(3 / (4 * Math.PI * mat.density));
      const area = 4 * Math.PI * rad * rad;
      const hot = T >= 800;
      const h = hot ? H_CONV.furnace : H_CONV.stillAir;
      heatHow = `${h.name} (h=${h.h} W/m²·K)`;
      const target = mat.meltC !== undefined ? Math.min(T, mat.meltC - 1) : T;
      const t = heatTimeS(1, th.c, area, h.h, T, 20, target);
      if (Number.isFinite(t) && t > 0) heatS = +t.toFixed(0);
    }
    r.measurements = { tempC: T, meltC: mat.meltC ?? "unknown", ignitionC: mat.ignitionC ?? "unknown",
      specificHeatJkgK: th?.c ?? "unknown", warm1kgFrom20CkJ: warmKJ, melt1kgFrom20CkJ: meltKJ,
      timeToHeat1kgS: heatS, heatModel: heatHow,
      emissivity: EMISSIVITY[matId]?.e ?? "unknown",
      radiationFluxKWm2: T >= 200 ? +(blackbodyFlux(T) / 1000).toFixed(1) : 0 };
    cite(r, "nist", "crc", "asm", "incropera", "stefan");
    if (typeof warmKJ === "number") unc(r, "warm1kgFrom20CkJ", warmKJ, UNCERTAINTY.meltEnergy.rel!, "c ±10%, Lf stacked");
    if (typeof meltKJ === "number") unc(r, "melt1kgFrom20CkJ", meltKJ, UNCERTAINTY.meltEnergy.rel!, "c ±10%, Lf stacked");
    if (typeof heatS === "number") unc(r, "timeToHeat1kgS", heatS, UNCERTAINTY.heatTime.rel!, "h ±50% dominates — order of magnitude, not a promise");
    // Biot check: uniform body temperature is honest only while Bi ≤ 0.1.
    // Thicker bodies and fiercer baths grow skin-to-core gradients the lumped
    // model cannot see — flagged, never faked (no internal conduction in-engine).
    {
      const k = mat.thermalWmK;
      if (k === undefined) {
        reason(r, "REAL", 0.6, `No conductivity data for ${mat.name} — heating times assume a uniform body; internal gradients UNKNOWN.`);
      } else {
        const rad = Math.cbrt(3 / (4 * Math.PI * mat.density));
        const Lc = rad / 3;
        const hB = T >= 800 ? H_CONV.furnace.h : H_CONV.stillAir.h;
        const Bi = (hB * Lc) / k;
        r.measurements.biotNumber = +Bi.toFixed(3);
        if (Bi > 0.1) {
          reason(r, "REAL", 0.7, `Biot ≈ ${Bi.toFixed(2)} (> 0.1): the skin outruns the core — quoted times are lower bounds; thick ${mat.name} lags behind.`);
        }
      }
    }
    unc(r, "tempC", T, 0, "exact input");
    if (mat.meltC !== undefined) unc(r, "meltC", mat.meltC, UNCERTAINTY.meltC.abs! / mat.meltC, "alloy shift ±15 K");
    if (T >= 800) {
      const em = EMISSIVITY[matId]?.e ?? 0.9;
      reason(r, "REAL", 0.85, `Radiation rules here: a surface at ${T}°C sheds σT⁴ ≈ ${(blackbodyFlux(T) / 1000).toFixed(0)} kW/m² (× ε=${em} for ${mat.name}) — convection-only heating times are upper bounds; the sim integrates both.`);
    }
    if (mat.meltC !== undefined && T >= mat.meltC) reason(r, "REAL", 0.98, `${mat.name} melts at ${mat.meltC}°C — at ${T}°C it is liquid. You would watch it puddle.${typeof meltKJ === "number" ? ` Melting 1 kg from 20°C costs ~${meltKJ} kJ (sensible + fusion).` : ""}${typeof heatS === "number" ? ` A 1 kg sphere reaches melting range in ~${heatS >= 3600 ? `${(heatS / 3600).toFixed(1)} h` : heatS >= 120 ? `${(heatS / 60).toFixed(0)} min` : `${heatS} s`} in ${heatHow} — then fusion soaks extra power at constant T.` : ""}`);
    else if (mat.ignitionC !== undefined && T >= mat.ignitionC) reason(r, "REAL", 0.95, `${mat.name} ignites at ${mat.ignitionC}°C — at ${T}°C it burns.${typeof warmKJ === "number" ? ` Warming 1 kg from 20°C to ${T}°C takes ~${warmKJ} kJ.` : ""}${typeof heatS === "number" ? ` Time to temperature: ~${heatS} s in ${heatHow}.` : ""}`);
    else if (mat.meltC !== undefined) reason(r, "NOT REAL", 0.95, `${mat.name} needs ${mat.meltC}°C to melt; ${T}°C only warms it. No melting. No fire.${typeof warmKJ === "number" ? ` (That warming soaks ~${warmKJ} kJ per kg.)` : ""}`);
    else reason(r, "MIXED", 0.5, `No melt/ignition data for ${mat.name} — cannot render thermal verdict.`);
    return r;
  }

  // 2b. CAPACITY — "how much water does a 1 m cube container hold".
  // Interior volume × fluid density: a report, not a splash.
  if (/\b(hold|holds|holding|capacity|volume|litre|liter|litres|liters|gallon|report|fit|fits|contain|contains|store|stores)\b/.test(p) &&
      (/\b(container|vessel|tank|barrel|bucket|bin|tub|basin|tray|reservoir|beaker|cup|mug|pot|drum|bottle|jar|box|cube|pool|cistern)\b/.test(p) || /fill|pour/.test(p))) {
    const r = fresh(input, envName);
    const lens: { value: number; unit: string; index: number }[] = [];
    const lr = /(\d+(?:\.\d+)?)\s?(mm|cm|meter|metre|meters|metres|km|ft|in|m)\b/g;
    const LU: Record<string, number> = { mm: 0.001, cm: 0.01, m: 1, km: 1000, ft: 0.3048, in: 0.0254 };
    let lm: RegExpExecArray | null;
    while ((lm = lr.exec(p))) {
      const u = lm[2].startsWith("meter") || lm[2].startsWith("metre") ? "m" : lm[2];
      lens.push({ value: parseFloat(lm[1]), unit: u, index: lm.index });
    }
    const cueIdx: number[] = [];
    for (const w of ["container", "vessel", "tank", "box", "cube", "size", "sized", "side", "height", "tall", "high", "wide", "diameter", "across", "litre", "liter"]) {
      let qi = p.indexOf(w);
      while (qi !== -1) { cueIdx.push(qi); qi = p.indexOf(w, qi + 1); }
    }
    const near = lens.filter((L) => cueIdx.some((c) => Math.abs(L.index - c) < 24));
    const pick = near[0] ?? lens[0] ?? null;
    if (!pick) {
      reason(r, "MIXED", 0.4, "Name a container size: 'a 1 meter cube container' (side, diameter, or height).");
      return r;
    }
    const s = pick.value * (LU[pick.unit] ?? 1);
    const spherical = /\b(sphere|ball|orb|globe|bead)\b/.test(p);
    const V = spherical ? (4 / 3) * Math.PI * (s / 2) ** 3 : s ** 3;
    const L = V * 1000;
    const gal = L / 3.78541;
    const f = FLUIDS[fluidId];
    const rho = f.density;
    const kg = rho !== undefined ? V * rho : null;
    r.measurements = {
      containerShape: spherical ? "sphere" : "cube", sideM: +s.toFixed(3),
      internalVolumeM3: +V.toFixed(4), capacityL: +L.toFixed(1), capacityUSGal: +gal.toFixed(1),
      fluid: f.name, fluidMassKg: kg !== null ? +kg.toFixed(1) : "unknown",
    };
    cite(r, "nist", "unesco");
    unc(r, "capacityL", L, 0.04, "dimension tolerance + density spread");
    if (kg !== null) unc(r, "fluidMassKg", kg, UNCERTAINTY.density.rel!, "fluid density spread");
    const shapeNote = spherical ? `${s} m sphere (diameter)` : `${s} m cube (per side)`;
    reason(r, "REAL", 0.95, `Interior: a ${shapeNote} encloses ${V.toFixed(V < 0.01 ? 4 : 3)} m³.`);
    reason(r, "REAL", 0.95, `Capacity: ≈${L >= 100 ? L.toFixed(0) : L.toFixed(1)} L (≈${gal >= 100 ? gal.toFixed(0) : gal.toFixed(1)} US gal) to the brim.`);
    if (kg !== null) {
      const like = kg >= 800 ? "about a small car" : kg >= 60 ? "about an adult human" : kg >= 8 ? "about a bowling ball" : "about a bag of flour";
      reason(r, "REAL", 0.9, `Filled with ${f.name}: ≈${kg >= 100 ? kg.toFixed(0) : kg.toFixed(1)} kg — ${like}. The staged tank in front of you is built to this size, filled live.`);
    } else {
      reason(r, "MIXED", 0.5, `Volume is exact, but no density data for ${f.name} — mass UNKNOWN, viscosity drag only.`);
    }
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
    cite(r, "unesco", "nist");
    unc(r, "bodyDensity", mat.density, UNCERTAINTY.density.rel!, "alloy/grade spread");
    const v = buoyancyVerdict(mat.density, f.density, mat.name, f.name);
    reason(r, v.includes("NOT REAL") ? "NOT REAL" : v.includes("UNKNOWN") ? "MIXED" : "REAL", 0.9, v + ` Simulated 4 s: rest height ${b.pos.y.toFixed(2)} m.`);
    return r;
  }

  // 3b. COMPARISON — "steel vs titanium: which is stronger", "is gold denser than lead".
  // Table-order-free: both sides are read by position, every axis with data is judged.
  {
    const vsM = p.match(/(.+?)\s+(?:vs\.?|versus|v\.?)\s+(.+)/);
    const whichM = p.match(/which.+?(stronger|weaker|harder|softer|denser|heavier|lighter|hotter|tougher|strongest|hardest|densest|heaviest)/);
    const thanM = p.match(/is\s+(\w+)\s+(stronger|harder|denser|heavier|hotter|tougher)\s+than\s+(\w+)/);
    const findMat = (s: string): string | null => {
      for (const k of Object.keys(MATERIALS)) {
        if (s.includes(k) || s.includes(MATERIALS[k].name.toLowerCase())) return k;
      }
      for (const [alias, id] of Object.entries(MAT_ALIAS)) {
        if (s.includes(alias) && MATERIALS[id]) return id;
      }
      return null;
    };
    let aId: string | null = null, bId: string | null = null;
    if (vsM) { aId = findMat(vsM[1]); bId = findMat(vsM[2]); }
    else if (thanM) { aId = findMat(thanM[1]); bId = findMat(thanM[3]); }
    else if (whichM) {
      const ids: string[] = [];
      for (const k of Object.keys(MATERIALS)) {
        if (p.includes(k) || p.includes(MATERIALS[k].name.toLowerCase())) ids.push(k);
      }
      if (ids.length >= 2) { aId = ids[0]; bId = ids[1]; }
    }
    if (aId && bId && aId !== bId) {
      const r = fresh(input, envName);
      const A = MATERIALS[aId], B = MATERIALS[bId];
      const strOf = (m: (typeof MATERIALS)[string]): number | null => m.ultimateMpa ?? m.tensileMpa ?? m.yieldMpa ?? null;
      const sA = strOf(A), sB = strOf(B);
      r.measurements = {
        a: A.name, b: B.name,
        strengthMpaA: sA ?? "unknown", strengthMpaB: sB ?? "unknown",
        mohsA: A.mohs ?? "unknown", mohsB: B.mohs ?? "unknown",
        densityA: A.density, densityB: B.density,
        meltCA: A.meltC ?? "unknown", meltCB: B.meltC ?? "unknown",
      };
      cite(r, "crc", "asm", "nist");
      unc(r, "densityA", A.density, UNCERTAINTY.density.rel!, "grade spread");
      unc(r, "densityB", B.density, UNCERTAINTY.density.rel!, "grade spread");
      const wins: string[] = [];
      if (sA !== null && sB !== null) {
        const w = sA === sB ? "tie" : sA > sB ? A.name : B.name;
        wins.push(`strength: ${w} (${sA} vs ${sB} MPa)`);
        reason(r, "REAL", 0.95, `Strength: ${A.name} ${sA} vs ${B.name} ${sB} MPa — ${w === "tie" ? "even match" : `${w} wins`}.`);
      }
      if (A.mohs !== undefined && B.mohs !== undefined) {
        const w = A.mohs === B.mohs ? "tie" : A.mohs > B.mohs ? A.name : B.name;
        wins.push(`hardness: ${w} (Mohs ${A.mohs} vs ${B.mohs})`);
        reason(r, "REAL", 0.95, `Hardness: ${A.name} Mohs ${A.mohs} vs ${B.name} Mohs ${B.mohs} — ${w === "tie" ? "mutual abrasion only" : `${w} scratches the other`}.`);
      }
      {
        const w = A.density === B.density ? "tie" : A.density > B.density ? A.name : B.name;
        wins.push(`density: ${w} (${A.density} vs ${B.density} kg/m³)`);
        reason(r, "REAL", 0.95, `Density: ${A.name} ${A.density} vs ${B.name} ${B.density} kg/m³ — ${w === "tie" ? "identical" : `${w} is denser and sinks first in any fluid`}.`);
      }
      if (A.meltC !== undefined && B.meltC !== undefined) {
        const w = A.meltC === B.meltC ? "tie" : A.meltC > B.meltC ? A.name : B.name;
        wins.push(`heat: ${w} (${A.meltC} vs ${B.meltC}°C)`);
        reason(r, "REAL", 0.95, `Heat: ${A.name} melts ${A.meltC} vs ${B.name} melts ${B.meltC}°C — ${w === "tie" ? "same limit" : `${w} survives hotter`}.`);
      }
      if (!wins.length) {
        reason(r, "MIXED", 0.4, `No comparable data for ${A.name} vs ${B.name} on any axis.`);
      }
      return r;
    }
  }

  // 4. SCRATCH verdicts (Mohs). Roles come from WORD ORDER: the first named
  // material is the tool, the last is the target ("quartz scratches glass" ≠ reverse).
  if (/scratch|cut|chisels?|mine|pickaxe|tool/.test(p)) {
    const r = fresh(input, envName);
    const hits: { idx: number; name: string; mohs: number }[] = [];
    for (const k of Object.keys(MATERIALS)) {
      const mo = MATERIALS[k].mohs;
      if (mo === undefined) continue;
      for (const w of [k, MATERIALS[k].name.toLowerCase()]) {
        let i = p.indexOf(w);
        while (i !== -1) { hits.push({ idx: i, name: MATERIALS[k].name, mohs: mo }); i = p.indexOf(w, i + 1); }
      }
    }
    for (const [lname, lv] of MOHS_LADDER) {
      let i = p.indexOf(lname);
      while (i !== -1) { hits.push({ idx: i, name: lname, mohs: lv }); i = p.indexOf(lname, i + 1); }
    }
    hits.sort((a, b) => a.idx - b.idx);
    const order: { name: string; mohs: number }[] = [];
    const seen = new Set<string>();
    for (const h of hits) {
      if (!seen.has(h.name)) { seen.add(h.name); order.push({ name: h.name, mohs: h.mohs }); }
    }
    if (order.length < 2) {
      reason(r, "MIXED", 0.4, "Need two named hard materials (e.g. 'can steel scratch quartz').");
      return r;
    }
    const tool = order[0], tgt = order[order.length - 1];
    const v = mohsVerdict(tool.mohs, tgt.mohs, tool.name, tgt.name);
    r.measurements = { toolMohs: tool.mohs, targetMohs: tgt.mohs, tool: tool.name, target: tgt.name };
    cite(r, "crc");
    reason(r, v.includes("NOT REAL") ? "NOT REAL" : "REAL", 0.95, v);
    return r;
  }

  // 5. HEAR / BLAST verdicts — sound delay + explosive tiers.
  if (/hear|sound|blast|explos|tnt|detonat/.test(p)) {
    const r = fresh(input, envName);
    const kmM = p.match(/(\d+(?:\.\d+)?)\s?km/);
    const mM = p.match(/(\d+(?:\.\d+)?)\s?m(?!\/s)/);
    const distM = kmM ? parseFloat(kmM[1]) * 1000 : mM ? parseFloat(mM[1]) : 1000;
    const cAir = planet.tempC !== null ? soundSpeed(planet.tempC) : PHYSICS.SOUND_AIR;
    const delay = soundDelay(distM, cAir);
    const lightS = lightDelay(distM);
    r.measurements = { distM, soundDelayS: +delay.toFixed(2), soundSpeedMs: +cAir.toFixed(1), lightDelayS: lightS };
    cite(r, "nist");
    unc(r, "soundDelayS", delay, UNCERTAINTY.soundDelay.rel!, "air temperature ±10°C");
    unc(r, "lightDelayS", lightS, 0, "c exact — distance is the only input");
    reason(r, "REAL", 0.95, `At ${distM} m you see the flash first and hear it ${delay.toFixed(1)} s later (sound ${cAir.toFixed(0)} m/s at ${planet.tempC ?? 20}°C — c grows with √T).`);
    reason(r, "REAL", 0.9, `The flash itself crossed those ${distM} m in ${(lightS * 1e6).toFixed(1)} µs at light speed — effectively instant at lab scale, which is why the game renders flashes immediately.`);
    if (planet.pressureAtm !== null && planet.pressureAtm < 0.05) {
      reason(r, "MIXED", 0.6, `Composition gap: this uses dry-AIR sound; ${planet.name}'s thin CO₂ air carries sound near ~227 m/s at these temperatures — treat the delay as order-of-magnitude there.`);
    }
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

  // 5b. HUMAN FALL — trauma-table survival odds (before ballistics grabs jump/fall).
  if (/human|person|astronaut|player|you\b|\bi\b/.test(p) && /fall|jump|drop|plunge/.test(p)) {
    const hM = p.match(/(\d+(?:\.\d+)?)\s?m/);
    const r = fresh(input, envName);
    if (!hM) { reason(r, "MIXED", 0.4, "Name a height: 'fall 12m' (human)."); return r; }
    const h = parseFloat(hM[1]);
    const v = fallSurvival(h, FALL_ODDS);
    r.measurements = { heightM: h, note: "LD50 ≈ 12 m" };
    cite(r, "osha");
    reason(r, v.includes("NOT REAL") ? "NOT REAL" : v.includes("MIXED") || v.includes("coin flip") ? "MIXED" : "REAL", 0.9, v);
    return r;
  }

  // 6. THROW / SHOOT / LAUNCH — ballistic verdict + simulated arc.
  // Understands m/s, km/s, km/h, mph, ft/s, knots, Mach N, and phrases
  // ("speed of light", "supersonic", "like a bullet"); heights in m/ft/mi.
  const velM = p.match(/(\d+(?:\.\d+)?)\s?(km\/s|ft\/s|cm\/s|mm\/s|km\/h|m\/s|kph|mph|fps|knots|knot|kn)\b/);
  const VEL2MS: Record<string, number> = {
    "m/s": 1, "km/s": 1000, "ft/s": 0.3048, "cm/s": 0.01, "mm/s": 0.001,
    "km/h": 1 / 3.6, kph: 1 / 3.6, mph: 0.44704, fps: 0.3048,
    knots: 0.514444, knot: 0.514444, kn: 0.514444,
  };
  const machM = p.match(/\bmach\s?(\d+(?:\.\d+)?)/);
  if (/throw|shoot|launch|fire|projectile|jump|fall|drop/.test(p) && !/laser|lase/.test(p)) {
    const r = fresh(input, envName);
    let v0 = velM ? parseFloat(velM[1]) * (VEL2MS[velM[2]] ?? 1) : 0;
    let velNote = velM && velM[2] !== "m/s" ? `${velM[1]}${velM[2]} = ${v0.toFixed(1)} m/s. ` : "";
    if (machM) { v0 = parseFloat(machM[1]) * 343; velNote = `Mach ${machM[1]} ≈ ${v0.toFixed(0)} m/s. `; }
    else if (/\bspeed of light\b|\blightspeed\b|\blight speed\b/.test(p)) { v0 = PHYSICS.C; velNote = `speed of light c = 299,792,458 m/s (relativistic — staged Newtonian, illustrative). `; }
    else if (/\bhypersonic\b/.test(p)) { v0 = 1700; velNote = "hypersonic ≈ 1,700 m/s. "; }
    else if (/\bsupersonic\b|\bsound barrier\b/.test(p)) { v0 = 400; velNote = "supersonic ≈ 400 m/s. "; }
    else if (/\blike a bullet\b|\bbullet\b|\brifle\b/.test(p)) { v0 = 900; velNote = "rifle bullet ≈ 900 m/s. "; }
    else if (/\bcannon\b/.test(p)) { v0 = 300; velNote = "cannon ≈ 300 m/s. "; }
    const hM = p.match(/from\s(\d+(?:\.\d+)?)\s?(km|m|ft|mi)?|(\d+(?:\.\d+)?)\s?(km|m|ft|mi)\s(high|tall|drop|fall|altitude)/);
    const LEN2M: Record<string, number> = { m: 1, km: 1000, ft: 0.3048, mi: 1609.34 };
    const hRaw = hM ? parseFloat(hM[1] ?? hM[3]) : 10;
    const hUnit = (hM ? (hM[2] ?? hM[4] ?? "m") : "m") as string;
    const h0 = Math.min(86000, hRaw * (LEN2M[hUnit] ?? 1));
    const angM = p.match(/(\d+(?:\.\d+)?)\s?(degrees?|deg|°)/);
    const ang = angM ? parseFloat(angM[1]) : /\bstraight up\b|\bvertical\b/.test(p) ? 90 : /\bflat\b|\bhorizontal\b/.test(p) ? 5 : 45;
    const w = new EngineWorld();
    w.env.gravity = planet.gravity;
    w.env.airDensity = planet.pressureAtm !== null && planet.pressureAtm < 0.01 ? 0.001 : PHYSICS.AIR_DENSITY;
    const altM = p.match(/altitude\s(\d+(?:\.\d+)?)\s?m/) ?? p.match(/(\d+(?:\.\d+)?)\s?m\saltitude/);
    if (altM) w.env.airDensity = altitudeDensity(parseFloat(altM[1]));
    const b = w.spawn({
      shape: "sphere", material: matId, sizeM: 0.5,
      pos: { x: 0, y: h0, z: 0 },
      vel: v0 ? { x: v0 * Math.cos((ang * Math.PI) / 180), y: v0 * Math.sin((ang * Math.PI) / 180), z: 0 } : undefined,
      dragProfile: "sphere",
    });
    // Word-order throw target ("over the wall into the pool"): a static slab
    // stands in the lane; clearance is measured live from the trajectory.
    const wallM = p.match(/\bover\s+(?:the\s+)?(?:(\w+)\s+)?(wall|fence|barrier)\b/);
    const wall = wallM ? w.spawn({ shape: "box", material: "concrete", sizeM: 1.5, pos: { x: 8, y: 1.5, z: 0 }, static: true }) : null;
    let minClear = Infinity, entered = false;
    const n = Math.ceil(12 * 120);
    for (let i = 0; i < n; i++) {
      w.step(1 / 120);
      if (wall && !b.broken) {
        const halfX = wall.halfM?.x ?? 1.5;
        if (Math.abs(b.pos.x - wall.pos.x) < halfX + b.radiusM) {
          entered = true;
          minClear = Math.min(minClear, b.pos.y - b.radiusM - (wall.pos.y + (wall.halfM?.y ?? 1.5)));
        }
      }
      if (i % 60 === 0) r.trace.push({ t: +w.time.toFixed(2), y: +b.pos.y.toFixed(2), v: +Math.hypot(b.vel.x, b.vel.y).toFixed(1), tempC: b.tempC, event: b.events[b.events.length - 1] });
      if (b.broken) break;
    }
    const range = Math.hypot(b.pos.x, b.pos.z);
    const vacRange = v0 ? projectileRange(v0, ang, planet.gravity) : 0;
    r.measurements = {
      v0ms: v0, heightM: h0, gravity: planet.gravity,
      altitudeM: altM ? parseFloat(altM[1]) : 0, airDensity: +w.env.airDensity.toFixed(4),
      simRangeM: +range.toFixed(1), vacuumRangeM: +vacRange.toFixed(1),
      terminalVms: +terminalVelocity(b.massKg, b.dragCd, b.areaM2, w.env.airDensity).toFixed(1),
      broken: b.broken,
    };
    cite(r, "isa", "nist");
    unc(r, "simRangeM", range, UNCERTAINTY.range.rel!, "drag + Cd spread");
    unc(r, "vacuumRangeM", vacRange, UNCERTAINTY.gravity.rel!, "g variation");
    unc(r, "terminalVms", terminalVelocity(b.massKg, b.dragCd, b.areaM2, w.env.airDensity), UNCERTAINTY.terminalV.rel!, "CdA ±20%");
    unc(r, "airDensity", w.env.airDensity, 0.02, "ISA band interpolation");
    // weaken gravity with altitude on high drops — the sim flies constant-g.
    if (h0 > 10000 && planet.radiusM) {
      const gTop = gravityAt(planet.gravity, planet.radiusM, h0);
      r.measurements.gravityAtStart = +gTop.toFixed(2);
      unc(r, "gravityAtStart", gTop, UNCERTAINTY.gravity.rel!, "spherical assumption");
      reason(r, "REAL", 0.8, `High drop: gravity at release is ${gTop.toFixed(2)} m/s² vs ${planet.gravity} surface — the sim flies constant-g, so treat fall time as ±5% above 10 km.`);
    }
    // Relativity check: Newton is fine until ~10% of light speed, then it lies.
    if (v0 > 0.01 * PHYSICS.C) {
      const g = lorentz(v0);
      const relJ = relKineticJ(b.massKg, v0);
      const newJ = 0.5 * b.massKg * v0 * v0;
      r.measurements.lorentzGamma = +g.toFixed(3);
      r.measurements.relativisticKEJ = +relJ.toExponential(2) as unknown as number;
      r.measurements.newtonianKEJ = +newJ.toExponential(2) as unknown as number;
      unc(r, "lorentzGamma", g, 0, "exact function of v");
      reason(r, "REAL", 0.9, `RELATIVITY: at ${(v0 / PHYSICS.C * 100).toFixed(1)}% of light speed γ=${g.toFixed(3)} — Newton says ${(newJ).toExponential(2)} J, Einstein says ${(relJ).toExponential(2)} J. The arc above is Newtonian and illustrative; the energy books must use γ.`);
      cite(r, "nist");
    }
    r.events = b.events;
    if (wall) {
      if (!entered) {
        r.measurements.wallClearM = "never reached";
        reason(r, "NOT REAL", 0.85, `${mat.name} sphere never reached the wall — it fell short. No clearance, no pool.`);
      } else if (minClear > 0) {
        r.measurements.wallClearM = +minClear.toFixed(2);
        unc(r, "wallClearM", minClear, UNCERTAINTY.range.rel!, "drag + Cd spread");
        reason(r, "REAL", 0.88, `Clears the 3 m wall by ${minClear.toFixed(2)} m — the over-the-wall line holds.`);
      } else {
        r.measurements.wallClearM = +minClear.toFixed(2);
        reason(r, "NOT REAL", 0.9, `Clips the wall (${minClear.toFixed(2)} m under the top) — it does NOT sail into the pool.`);
      }
    }
    if (b.broken) reason(r, "REAL", 0.9, `${velNote}It does NOT survive: ${b.events[b.events.length - 1]}`);
    else if (v0 && range < vacRange * 0.5) reason(r, "REAL", 0.85, `${velNote}Short of vacuum range (${vacRange.toFixed(0)} m → ${range.toFixed(0)} m): drag is eating it alive. Games that ignore this are NOT REAL.`);
    else reason(r, "REAL", 0.85, `${velNote}Lands ${range.toFixed(1)} m out, intact. Numbers above — check any game against them.`);
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

  // 9. ELECTRIFY — conductivity vs breakdown (science.ts codex II).
  if (/electr|shock|zap|taser|lightning|live wire|short circuit/.test(p)) {
    const r = fresh(input, envName);
    const ELEC_MAP: Record<string, string> = {
      copper: "copper", aluminium: "aluminium", steel: "steel", titanium: "titanium",
      graphite: "graphite", rubber: "rubber", teflon: "teflon",
      water: "pureWater", ice: "pureWater", glass: "quartzGlass",
    };
    const key = ELEC_MAP[matId];
    const vM = p.match(/(\d+(?:\.\d+)?)\s?(kv|v|volts)/);
    const volts = vM ? parseFloat(vM[1]) * (vM[2] === "kv" ? 1000 : 1) : 230;
    if (!key || !ELECTRICAL[key]) {
      reason(r, "MIXED", 0.4, `No electrical data for ${mat.name} — name copper, steel, rubber, glass, water…`);
      return r;
    }
    const e = ELECTRICAL[key];
    const v = electroVerdict(e.conductivity, e.breakdownMVm, e.name);
    r.measurements = { conductivitySm: e.conductivity, breakdownMVm: e.breakdownMVm, volts, certainty: e.certainty };
    cite(r, "crc");
    const holds = e.conductivity < 1e3 && volts < e.breakdownMVm * 1e6;
    reason(r, "REAL", 0.92, v + (e.conductivity >= 1e3
      ? ` At ${volts} V it arcs and flows.`
      : holds ? ` At ${volts} V across ~1 m it holds (needs ${(e.breakdownMVm * 1e6).toExponential(0)} V to arc).`
        : ` At ${volts} V it ARCS across ~1 m — insulation defeated.`));
    if (fluidId === "seawater" || fluidId === "water") {
      reason(r, "REAL", 0.85, `${FLUIDS[fluidId].name} (σ=${ELECTRICAL[fluidId === "seawater" ? "seawater" : "pureWater"].conductivity} S/m) spreads the current — lethal to swim in.`);
    }
    return r;
  }

  // 10. DISSOLVE / CORRODE — acid vs material timelines.
  if (/dissolv|corrod|acid|bleach|drain cleaner|etch/.test(p)) {
    const r = fresh(input, envName);
    const acidId = /drain cleaner/.test(p) ? "drainCleaner"
      : /gastric|stomach/.test(p) ? "gastricAcid"
      : /bleach/.test(p) ? "bleach"
      : /battery/.test(p) || /acid/.test(p) ? "batteryAcid"
      : /pure water/.test(p) ? "pureWater" : "batteryAcid";
    const CORR_MAP: Record<string, string> = {
      steel: "steel", aluminium: "aluminium", titanium: "titanium", glass: "glass",
      iron: "steel", copper: "steel",
    };
    const targetKey = /human|flesh|skin|hand|body|tissue/.test(p) ? "tissue" : CORR_MAP[matId];
    const acid = ACIDS[acidId];
    if (!targetKey || CORROSION_MIN[acidId][targetKey] === undefined) {
      reason(r, "MIXED", 0.4, `No corrosion timeline for ${mat.name} in ${acid.name} — covered: steel, aluminium, titanium, glass, tissue.`);
      return r;
    }
    const mins = CORROSION_MIN[acidId][targetKey];
    const v = corrosionVerdict(mins, acid.name, targetKey === "tissue" ? "flesh" : mat.name);
    r.measurements = { acid: acid.name, ph: acid.ph, minutesToDestroy10mm: mins >= IMMUNE_MIN ? "immune" : mins };
    cite(r, "crc");
    reason(r, mins >= IMMUNE_MIN ? "REAL" : "NOT REAL", 0.9, v + (mins >= IMMUNE_MIN ? " It survives." : " It does not survive."));
    return r;
  }

  // 11. LASER — Snell refraction through a medium.
  if (/laser|lase|\bbeam\b/.test(p)) {
    const r = fresh(input, envName);
    const OPT_MAP: Record<string, string> = { diamond: "diamond", glass: "glass", water: "water", ice: "ice" };
    const key = OPT_MAP[matId] ?? (/sapphire/.test(p) ? "sapphire" : /flint/.test(p) ? "flint" : null);
    if (!key || !OPTICS[key]) {
      reason(r, "MIXED", 0.4, "Name the medium: glass, diamond, water, ice, sapphire.");
      return r;
    }
    const o = OPTICS[key];
    const { bendDeg, note } = snellBend(o.n);
    r.measurements = { medium: o.name, refractiveIndex: o.n, dielectricConstant: o.epsilon, bendDegFrom45: +bendDeg.toFixed(1) };
    cite(r, "schott", "nist");
    reason(r, "REAL", 0.93, `Laser through ${o.name}: ${note}. High εr=${o.epsilon} also stores charge well.`);
    return r;
  }

  // 12. ROLL — rolling-resistance stop distance.
  if (/\broll\b/.test(p)) {
    const r = fresh(input, envName);
    const pairId = /rail|railroad|train/.test(p) ? "railSteel"
      : /wet/.test(p) ? "tyreWet" : /gravel/.test(p) ? "tyreGravel"
      : /sand/.test(p) ? "tyreSand" : /ice/.test(p) ? "tyreIce"
      : /snow/.test(p) ? "tyreSnow" : /mud|truck/.test(p) ? "truckMud"
      : /tank|tracks|crawler/.test(p) ? "tracksGround" : /clay|tractor/.test(p) ? "tractorClay"
      : /concrete/.test(p) ? "tyreConcrete" : "tyreAsphalt";
    const velM = p.match(/(\d+(?:\.\d+)?)\s?m\/s/);
    const v0 = velM ? parseFloat(velM[1]) : 10;
    const pr = ROLLING[pairId];
    const d = rollingStop(v0, pr.crr, planet.gravity);
    r.measurements = { pair: pr.name, crr: pr.crr, v0ms: v0, stopDistanceM: +d.toFixed(1) };
    cite(r, "sae");
    unc(r, "stopDistanceM", d, 0.15, "c_rr surface variance");
    reason(r, "REAL", 0.9, `Coasting at ${v0} m/s on ${pr.name} (c_rr=${pr.crr}) rolls ~${d.toFixed(0)} m before stopping.`);
    return r;
  }

  // 13. RADIATION — inverse-square dose from an isotope.
  if (/radiat|sievert|geiger|uranium|plutonium|cobalt|radon|tritium|carbon-14|isotope/.test(p)) {
    const r = fresh(input, envName);
    const isoId = /cobalt/.test(p) ? "cobalt60"
      : /plutonium-238|rtg/.test(p) ? "plutonium238" : /plutonium/.test(p) ? "plutonium239"
      : /radon/.test(p) ? "radon222" : /tritium/.test(p) ? "tritium"
      : /carbon-14/.test(p) ? "carbon14"
      : /uranium-235|enriched/.test(p) ? "uranium235" : /uranium|depleted/.test(p) ? "uranium238" : null;
    if (!isoId || !ISOTOPES[isoId]) {
      reason(r, "MIXED", 0.4, "Name an isotope: cobalt-60, uranium, plutonium, radon, tritium.");
      return r;
    }
    const iso = ISOTOPES[isoId];
    const kgM = p.match(/(\d+(?:\.\d+)?)\s?kg/);
    const dM = p.match(/(\d+(?:\.\d+)?)\s?m(?!\/s)/);
    const dose = doseAt(iso.doseUSvH, kgM ? parseFloat(kgM[1]) : 1, dM ? parseFloat(dM[1]) : 1);
    r.measurements = { isotope: iso.name, halfLifeS: iso.halfLifeS, doseUSvH: +dose.toFixed(2) };
    cite(r, "iaea");
    unc(r, "doseUSvH", dose, UNCERTAINTY.dose.rel!, "point-source, no shielding");
    if (dose >= 1000) reason(r, "NOT REAL", 0.97, `${dose.toFixed(0)} μSv/h — lethal within the hour. No unshielded handling.`);
    else if (dose >= 10) reason(r, "MIXED", 0.85, `${dose.toFixed(1)} μSv/h — dangerous; minutes only, then shielding.`);
    else if (dose >= 1) reason(r, "REAL", 0.85, `${dose.toFixed(2)} μSv/h — elevated, brief handling only.`);
    else reason(r, "REAL", 0.9, `${dose.toFixed(2)} μSv/h — near background, safe to stand by.`);
    return r;
  }

  // 13b. ORBIT / ESCAPE — circular orbit velocity, period, escape velocity.
  if (/orbit|revolve|circle|circular|escape velocity|escape speed|satellite|space station/.test(p) && planet.mu && planet.radiusM) {
    const r = fresh(input, envName);
    let altM = 400000; // default: low orbit, ISS-style
    const m1 = p.match(/(\d+(?:\.\d+)?)\s?(km|m)\b.*?(orbit|altitude|high|above)/);
    const m2 = p.match(/(orbit|altitude).*?(\d+(?:\.\d+)?)\s?(km|m)\b/);
    if (m1) altM = parseFloat(m1[1]) * (m1[2] === "m" ? 1 : 1000);
    else if (m2) altM = parseFloat(m2[2]) * (m2[3] === "m" ? 1 : 1000);
    const ov = orbitVelocity(planet.mu, planet.radiusM, altM);
    const period = orbitPeriodS(planet.mu, planet.radiusM, altM);
    const esc = escapeVelocity(planet.mu, planet.radiusM);
    r.measurements = { altitudeM: altM, orbitVelocityMs: +ov.toFixed(0), orbitPeriodMin: +(period / 60).toFixed(1), escapeVelocityKms: +(esc / 1000).toFixed(2) };
    cite(r, "jpl");
    unc(r, "orbitVelocityMs", ov, UNCERTAINTY.orbitV.rel!, "mu + spherical assumption");
    unc(r, "orbitPeriodMin", period / 60, UNCERTAINTY.orbitV.rel!, "mu + spherical assumption");
    unc(r, "escapeVelocityKms", esc / 1000, UNCERTAINTY.orbitV.rel!, "mu + spherical assumption");
    reason(r, "REAL", 0.95, `Circular orbit ${(altM / 1000).toFixed(0)} km over ${planet.name}: ${ov.toFixed(0)} m/s, one lap every ${(period / 60).toFixed(0)} min. Slower falls back, faster escapes the circle.`);
    if (/escape/.test(p)) reason(r, "REAL", 0.95, `Escape from ${planet.name}: ${(esc / 1000).toFixed(2)} km/s at the surface — the flat-plane game cannot show this; the number is the truth.`);
    else reason(r, "REAL", 0.7, `Honest limit: the game world is a flat plane — orbits are closed-form numbers, not flown paths.`);
    return r;
  }

  // 14. GAS — ppm toxicity tiers.
  if (/ppm|carbon monoxide|hydrogen sulfide|mercury vapor|toxic|gas leak/.test(p)) {
    const r = fresh(input, envName);
    const gasId = /sulfide|h2s|rotten/.test(p) ? "h2s" : /mercury/.test(p) ? "mercury" : "co";
    const ppmM = p.match(/(\d+(?:\.\d+)?)\s?ppm/);
    if (!ppmM) { reason(r, "MIXED", 0.4, "Name a concentration: '400 ppm carbon monoxide'."); return r; }
    const ppm = parseFloat(ppmM[1]);
    const g = GASTOX[gasId];
    const v = toxicityTier(ppm, g, g.name);
    r.measurements = { gas: g.name, ppm, lethalPpm: g.lethalPpm };
    cite(r, "osha");
    unc(r, "lethalPpm", g.lethalPpm, UNCERTAINTY.toxicity.rel!, "individual variance");
    reason(r, v.includes("NOT") ? "NOT REAL" : "REAL", 0.9, v);
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
  if (s.wind) w.env.wind = { x: s.wind[0], y: s.wind[1], z: s.wind[2] };
  const descs = s.bodies ?? [{ shape: "box", material: "oak", sizeM: 1, heightM: 20 }];
  const bodies = descs.map((d) =>
    w.spawn({
      shape: d.shape, material: d.material, sizeM: d.sizeM,
      pos: { x: d.x ?? 0, y: d.heightM ?? 10, z: 0 }, vel: d.vel ? { x: d.vel[0], y: d.vel[1], z: d.vel[2] } : undefined,
      tempC: d.tempC, dragProfile: d.dragProfile,
      ghost: d.ghost, massOverrideKg: d.massKg,
      static: d.static, spin: d.spin ? { x: d.spin[0], y: d.spin[1], z: d.spin[2] } : undefined,
    }));
  // Slosh tethers: ghost cargo cores pull on their shells (approx pendulum).
  descs.forEach((d, bi) => {
    if (d.cargoOf !== undefined && bodies[bi] && bodies[d.cargoOf]) {
      w.tether(bodies[bi].id, bodies[d.cargoOf].id, d.fillFrac ?? 1);
    }
  });
  const n = Math.ceil((s.durationS ?? 8) * 120);
  r.traces = {};
  for (const bd of bodies) r.traces[bd.id] = [];
  // Wall-clearance tracking ("over the wall"): closest approach while in the gate.
  const wallTracks = (s.checks ?? []).filter((c) => c.kind === "clears-wall").map((c) => {
    const wall = c.kind === "clears-wall" ? bodies[c.wall ?? bodies.length - 1] : undefined;
    const racer = c.kind === "clears-wall" ? bodies[c.body ?? 0] : undefined;
    return { wall, racer, minClear: Infinity, entered: false };
  });
  for (let i = 0; i < n; i++) {
    w.step(1 / 120);
    for (const t of wallTracks) {
      if (!t.wall || !t.racer || t.racer.broken) continue;
      const halfX = t.wall.shape === "box" ? (t.wall.halfM?.x ?? 1) : t.wall.radiusM;
      const r0 = t.racer.shape === "sphere" ? t.racer.radiusM : (t.racer.halfM?.y ?? 0.5);
      const top = t.wall.pos.y + (t.wall.shape === "box" ? (t.wall.halfM?.y ?? 1) : t.wall.radiusM);
      if (Math.abs(t.racer.pos.x - t.wall.pos.x) < halfX + r0) {
        t.entered = true;
        t.minClear = Math.min(t.minClear, t.racer.pos.y - r0 - top);
      }
    }
    if (i % 120 === 0) {
      for (const bd of bodies) {
        r.traces[bd.id].push({ t: +w.time.toFixed(1), y: +bd.pos.y.toFixed(2), v: +Math.hypot(bd.vel.x, bd.vel.y, bd.vel.z).toFixed(1), tempC: +bd.tempC.toFixed(1) });
      }
      const b = bodies[0];
      r.trace.push({ t: +w.time.toFixed(1), y: +b.pos.y.toFixed(2), v: +Math.hypot(b.vel.x, b.vel.y, b.vel.z).toFixed(1), tempC: +b.tempC.toFixed(1) });
    }
    if (bodies.every((b) => b.broken || (b.pos.y <= (b.shape === "sphere" ? b.radiusM : b.halfM!.y) + 0.01 && Math.hypot(b.vel.x, b.vel.y, b.vel.z) < 0.3))) break;
  }
  const b = bodies[0];
  const impactV = +Math.hypot(b.vel.x, b.vel.y, b.vel.z).toFixed(1);
  r.measurements = {
    bodies: bodies.length, simTimeS: +w.time.toFixed(2),
    impactVms: impactV,
    broken: b.broken, molten: b.molten, burning: b.burning,
    humanTerminalVms: +humanTerminal().toFixed(1),
  };
  r.measurements.bodyTable = bodies.map((bd) => ({
    id: bd.id, material: bd.material.name, shape: bd.shape,
    broken: bd.broken, molten: bd.molten,
    restY: +bd.pos.y.toFixed(2), speed: +Math.hypot(bd.vel.x, bd.vel.y, bd.vel.z).toFixed(1),
  }));  r.events = w.log;
  cite(r, "nist", "isa");
  unc(r, "impactVms", impactV, UNCERTAINTY.impactV.rel!, "air + 120 Hz step");
  unc(r, "simTimeS", w.time, 0.01, "fixed-step clock");
  for (const c of s.checks ?? []) {
    const bb = bodies["body" in c && c.body !== undefined ? c.body : 0] ?? bodies[0];
    const tag = bodies.length > 1 ? `${bb.material.name} ${bb.shape}: ` : "";
    if (c.kind === "survives-fall") {
      if (bb.broken) reason(r, "REAL", 0.92, `${tag}NOT survivable as shown: ${bb.events[bb.events.length - 1] ?? w.log[w.log.length - 1] ?? "shattered"}. Any game where this survives a ${c.heightM} m fall is NOT REAL.`);
      else reason(r, "REAL", 0.85, `${tag}Survives a ${c.heightM} m fall intact — impact within ${bb.material.name} limits.`);
    } else if (c.kind === "floats-in") {
      const f = FLUIDS[c.fluid] ?? FLUIDS.water;
      const v = buoyancyVerdict(bb.material.density, f.density, bb.material.name, f.name);
      r.measurements.fluid = f.name;
      reason(r, v.includes("UNKNOWN") ? "MIXED" : "REAL", 0.9, tag + v);
      // Hot fluids cook: lava doesn't just float things, it melts them.
      if ((f.tempC ?? 0) >= 500) {
        const m = bb.material;
        cite(r, "stefan");
        if (m.meltC !== undefined && f.tempC! >= m.meltC) reason(r, "REAL", 0.97, `${tag}${f.name} at ${f.tempC}°C melts ${m.name} (${m.meltC}°C) — splash, then liquid. Watch it puddle live.`);
        else if (m.ignitionC !== undefined && f.tempC! >= m.ignitionC) reason(r, "REAL", 0.95, `${tag}${f.name} at ${f.tempC}°C ignites ${m.name} (${m.ignitionC}°C) — it burns on the surface.`);
        else if (m.meltC !== undefined) reason(r, "REAL", 0.9, `${tag}${f.name} at ${f.tempC}°C cannot melt ${m.name} (${m.meltC}°C) — it rides the lava intact.`);
        else reason(r, "MIXED", 0.5, `${tag}No melt data for ${m.name} — its fate in lava is UNKNOWN.`);
      }
    } else if (c.kind === "scratch") {
      const tool = MATERIALS[c.tool]?.mohs, tgt = MATERIALS[c.target]?.mohs;
      if (tool === undefined || tgt === undefined) reason(r, "MIXED", 0.4, "Unknown Mohs data for one side.");
      else { const v = mohsVerdict(tool, tgt, c.tool, c.target); reason(r, v.includes("NOT REAL") ? "NOT REAL" : "REAL", 0.95, v); }
    } else if (c.kind === "melt-at") {
      const m = bb.material;
      if (m.meltC !== undefined && c.tempC >= m.meltC) reason(r, "REAL", 0.97, `${m.name} melts at ${m.meltC}°C; ${c.tempC}°C liquefies it.`);
      else if (m.meltC !== undefined) reason(r, "NOT REAL", 0.95, `${c.tempC}°C cannot melt ${m.name} (${m.meltC}°C).`);
      else reason(r, "MIXED", 0.4, "No melt data.");
    } else if (c.kind === "hear-at") {
      const d = soundDelay(c.distM, c.mediumMs ?? PHYSICS.SOUND_AIR);
      r.measurements.soundDelayS = +d.toFixed(2);
      reason(r, "REAL", 0.95, `Heard ${d.toFixed(1)} s after seen at ${c.distM} m.`);
    } else if (c.kind === "lands-first") {
      // Landing-order race: rank non-static, non-cargo bodies by touchdown.
      const racers = bodies
        .map((bd, i) => ({ bd, i }))
        .filter(({ bd }) => !bd.isStatic && !bd.ghost);
      const timed = racers.map(({ bd, i }) => ({
        name: `${bd.material.name} ${bd.shape}`, t: bd.landedT, broken: bd.broken, i,
      }));
      timed.sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity));
      r.measurements.landingOrder = timed.map((t) => ({
        body: t.name, touchdownS: t.t !== null ? +t.t.toFixed(2) : "airborne", broken: t.broken,
      }));
      cite(r, "isa");
      if (!timed.length) {
        reason(r, "MIXED", 0.4, "No racers staged — name two materials to race.");
      } else {
        const line = timed.map((t, k) =>
          `${k + 1}. ${t.name} (${t.t !== null ? `${t.t.toFixed(2)} s` : "still airborne"})`).join(" · ");
        const winner = timed[0];
        const close = timed.length > 1 && timed[1].t !== null && winner.t !== null
          && Math.abs(timed[1].t - winner.t) < 0.05;
        reason(r, "REAL", 0.9, `Touchdown order: ${line}.${close ? " Dead heat inside 0.05 s — drag, not destiny, decides the rerun." : ` ${winner.name} lands first.`}`);
      }
    } else if (c.kind === "clears-wall") {
      const t = wallTracks[0];
      const bb2 = bodies[c.body ?? 0] ?? bodies[0];
      if (!t || !t.wall) {
        reason(r, "MIXED", 0.4, "Wall was never staged — clearance UNKNOWN.");
      } else if (!t.entered) {
        reason(r, "NOT REAL", 0.85, `${bb2.material.name} ${bb2.shape} never reached the wall — it fell short. No clearance, no pool.`);
        r.measurements.wallClearM = "never reached";
      } else if (t.minClear > 0) {
        r.measurements.wallClearM = +t.minClear.toFixed(2);
        unc(r, "wallClearM", t.minClear, UNCERTAINTY.range.rel!, "drag + Cd spread");
        reason(r, "REAL", 0.88, `${bb2.material.name} ${bb2.shape} clears the ${t.wall.pos.y * 2} m wall by ${t.minClear.toFixed(2)} m — over the wall, into the pool line holds.`);
      } else {
        r.measurements.wallClearM = +t.minClear.toFixed(2);
        reason(r, "NOT REAL", 0.9, `${bb2.material.name} ${bb2.shape} clips the wall (${t.minClear.toFixed(2)} m under the top) — it does NOT sail into the pool.`);
      }
    }
  }
  // Conditional branch: the condition ran first; narrate the taken branch.
  if (s.branch) {
    const ifB = bodies[s.branch.ifBody], thenB = bodies[s.branch.thenBody];
    if (ifB && thenB) {
      r.measurements.conditionMet = ifB.broken;
      if (ifB.broken) {
        reason(r, "REAL", 0.9, `IF TRUE: ${ifB.material.name} ${ifB.shape} shattered (${ifB.events[ifB.events.length - 1] ?? "impact failure"}) — so the consequent is live: ${thenB.material.name} ${thenB.shape} ${thenB.broken ? "also breaks" : "holds"} on its own fall.`);
      } else {
        reason(r, "REAL", 0.85, `IF FALSE: ${ifB.material.name} ${ifB.shape} held — the consequent (${thenB.material.name} ${thenB.shape}) never triggers; its staged fall is judged as its own setup ${thenB.broken ? "and it would break too" : "and it holds"}.`);
      }
    }
  }
  if (!(s.checks ?? []).length) {
    reason(r, "REAL", 0.7, `Baseline drop-test complete: ${b.broken ? "shattered" : "intact"}. Add checks for verdicts.`);
  }
  return r;
}
