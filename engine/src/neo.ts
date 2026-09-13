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
// verbs × shapes × materials × size-units × height-units × velocity-phrases
// × targets × planets — well past 100,000 structures. neoSamples(seed, n)
// materializes deterministic examples from that space, so the 100k+ dataset
// is generated, never stored.
import { MATERIALS, FLUIDS } from "./materials.js";
import { PLANETS } from "./planets.js";
import { altitudeDensity } from "./science.js";
import type { ScenarioDesc } from "./experience.js";

// ---------------------------------------------------------------- vocabulary

export type NeoAction =
  "drop" | "throw" | "melt" | "freeze" | "burn" | "boil" | "crush" |
  "float" | "sink" | "slide" | "scratch" | "blast" | "build" | "pour" |
  "electrify" | "dissolve" | "lase" | "roll" | "orbit";

const VERBS: Record<NeoAction, string[]> = {
  drop: ["drop", "plop", "release", "letgo", "dump", "unload", "detach", "dangle", "hover", "levitate", "lower", "rain", "shower", "plummet", "plunge", "nosedive", "fall", "falls", "fell", "survive", "survives", "survival"],
  throw: ["throw", "toss", "hurl", "launch", "shoot", "fling", "yeet", "lob", "chuck", "heave", "sling", "catapult", "cannon", "propel", "pelt", "pitch", "bowl", "serve", "volley", "snipe", "discharge"],
  melt: ["melt", "smelt", "liquefy", "thaw", "defrost", "puddle", "soften", "vaporize", "vaporise", "sublime", "heat", "warm", "superheat", "preheat", "cook", "bake", "roast", "toast"],
  freeze: ["freeze", "chill", "frost", "refrigerate", "supercool", "solidify", "cryo", "cool", "frostbite"],
  burn: ["burn", "ignite", "combust", "torch", "incinerate", "kindle", "char", "scorch", "sear", "flame"],
  boil: ["boil", "evaporate", "simmer", "steam", "distill", "bubble"],
  crush: ["crush", "smash", "squash", "shatter", "stomp", "hammer", "flatten", "squish", "pound", "bash", "slam", "crash", "collide", "ram", "wreck", "demolish", "pulverize", "bend", "twist", "shear", "dent", "puncture", "fracture", "deform", "compress", "stretch", "snap", "break", "hit", "strike", "kick", "punch", "knock", "slap", "whack", "thump", "clobber", "squeeze"],
  float: ["float", "bob", "drift", "buoy"],
  sink: ["sink", "dunk", "submerge", "immerse", "soak"],
  slide: ["slide", "slip", "glide", "skid", "skate", "ski", "sled", "toboggan", "slither", "coast", "push", "pull", "drag", "tow", "haul", "shove", "tug"],
  scratch: ["scratch", "cut", "mine", "carve", "chisel", "grind", "engrave", "score", "saw", "drill", "file", "sand", "polish", "sharpen", "whittle", "poke", "prod", "jab", "pierce", "prick"],
  blast: ["blast", "explode", "detonate", "blowup", "nuke", "bomb", "burst", "erupt", "boom"],
  build: ["build", "stack", "place", "put", "construct", "assemble", "erect", "raise", "pile", "arrange", "form", "create", "craft"],
  pour: ["pour", "flood", "fill", "spill", "decant", "drench", "douse", "irrigate"],
  electrify: ["electrify", "electrocute", "shock", "zap", "taser", "charge", "jolt", "lightning"],
  dissolve: ["dissolve", "corrode", "etch", "erode", "pickle", "rust", "oxidize", "rot"],
  lase: ["lase", "laser", "beam", "refract"],
  roll: ["roll", "tumble", "wheel", "trundle", "spin", "rotate", "whirl"],
  orbit: ["orbit", "revolve", "circle", "circumnavigate"],
};
// "fire" is genuinely ambiguous (fire a cannon vs set on fire) — resolved by
// context in parse(): velocity/angle/target words → throw, else burn.
const FIRE_WORD = "fire";

const SHAPES: { shape: "box" | "sphere"; words: string[] }[] = [
  { shape: "box", words: ["cube", "box", "block", "crate", "brick", "dice", "ingot", "slab", "plank", "sheet", "chunk", "lump", "bar", "rod", "beam", "pipe", "plate", "disc", "coin", "tile", "panel", "pillar", "column", "anvil", "container", "vessel", "tank", "barrel", "bucket", "bin", "tub", "basin", "tray", "reservoir", "beaker", "cup", "mug", "pot", "drum", "bottle", "jar", "pail", "cask", "keg", "tote", "hopper", "silo", "cistern", "aquarium", "pyramid", "cone", "cylinder", "capsule", "torus", "wedge", "prism", "cuboid", "monolith", "obelisk"] },
  { shape: "sphere", words: ["sphere", "ball", "orb", "marble", "globe", "bead", "droplet", "bubble", "pellet", "pebble", "boulder", "cannonball", "egg", "berry", "grape", "meteor", "asteroid", "comet", "satellite", "bowling", "golfball", "tennisball", "football", "wreckingball", "planetoid", "balloon", "waterballoon"] },
];

const MAT_ALIAS: Record<string, string> = {
  wood: "oak", wooden: "oak", timber: "oak", log: "oak", plank: "oak", lumber: "oak",
  plywood: "oak", mahogany: "oak", pine: "oak", birch: "oak",
  metal: "steel", steel: "steel", stainless: "steel", iron: "iron", castiron: "iron",
  brass: "brass", bronze: "bronze", copper: "copper", aluminum: "aluminium",
  titanium: "titanium", lead: "lead", gold: "gold", silver: "silver",
  nickel: "nickel", zinc: "zinc", platinum: "platinum",
  rock: "concrete", stone: "concrete", cement: "concrete", brick: "concrete",
  marble: "marble", granite: "granite", limestone: "concrete", sandstone: "concrete",
  plastic: "teflon", teflon: "teflon", nylon: "teflon", pvc: "teflon", acrylic: "teflon",
  glass: "glass", crystal: "glass", quartz: "glass", mirror: "glass",
  diamond: "diamond", gem: "diamond", ruby: "tungstenCarbide", sapphire: "tungstenCarbide",
  rubber: "rubber", tire: "rubber", tyre: "rubber", elastic: "rubber",
  ice: "ice", glacier: "ice", frost: "ice", snowball: "ice", hail: "ice",
  foam: "styrofoam", styrofoam: "styrofoam", polystyrene: "styrofoam",
  graphite: "graphite", pencil: "graphite", carbon: "carbonFibre", fiber: "carbonFibre",
  carbide: "tungstenCarbide", tungsten: "tungstenCarbide",
  bamboo: "bamboo", reed: "bamboo", cork: "cork", bark: "cork",
  soil: "soil", dirt: "soil", mud: "soil", clay: "clay", loam: "soil",
  sand: "sand", gravel: "sand", grit: "sand",
  coal: "coal", charcoal: "coal", paper: "paper", cardboard: "paper",
  aerogel: "aerogel", gel: "aerogel",
  silicone: "rubber", halite: "salt",
};
const FLUID_ALIAS: Record<string, string> = {
  sea: "water", ocean: "water", pool: "water", pond: "water", lake: "water", river: "water",
  rain: "water", puddle: "water", stream: "water", creek: "water", bay: "water",
  saltwater: "seawater", salt: "seawater", brine: "seawater",
  magma: "lava", lava: "lava", volcano: "lava", moltenrock: "lava",
  coffee: "milk", tea: "milk",
  oil: "motorOil", petrol: "motorOil", diesel: "diesel", gasoline: "motorOil", fuel: "motorOil",
  olive: "oliveOil", cooking: "oliveOil",
  syrup: "honey", molasses: "honey",
  sauce: "ketchup", ketchup: "ketchup",
  quicksilver: "mercury",
  milk: "milk", blood: "blood", alcohol: "alcohol", vodka: "alcohol", juice: "milk",
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
  // speed / velocity talk
  "speed", "velocity", "fast", "slow", "quick", "rapid", "lightspeed", "light",
  "lightning", "supersonic", "hypersonic", "subsonic", "sonic", "mach", "relativistic",
  "relativity", "newtonian", "warp", "hyperdrive", "bullet", "cannonball",
  "jet", "rocket", "missile", "racecar", "cheetah", "snail", "crawl", "sprint",
  "mph", "kph", "fps", "knots", "knot",
  // height / sky talk
  "sky", "skies", "air", "airborne", "cloud", "clouds", "stratosphere", "troposphere",
  "space", "orbit", "cliff", "tower", "bridge", "rooftop", "roof", "mountain",
  "hill", "balcony", "window", "drone", "helicopter", "plane", "airplane",
  "parachute", "skydive", "top", "peak", "summit", "ledge", "platform", "crane",
  "skyscraper", "building", "story", "storey", "ladder", "diving", "board",
  // experiment talk
  "experiment", "test", "trial", "demo", "simulation", "sim", "run", "repeat",
  "again", "versus", "against", "between", "compare", "strongest", "hardest",
  "toughest", "hottest", "coldest", "heaviest", "lightest", "biggest", "smallest",
  "survive", "survives", "survival", "break", "breaks", "broken", "shatter",
  "shatters", "shattered", "explode", "explodes", "sink", "sinks", "float",
  "floats", "melt", "melts", "burn", "burns", "freeze", "freezes",
  "please", "now", "just", "really", "very", "super", "ultra", "mega", "hyper",
  "approximately", "about", "around", "exactly", "almost", "nearly", "over",
  "under", "straight", "directly", "vertically", "horizontally", "diagonally",
  "upwards", "downwards", "sideways", "drop-test", "science", "physics", "real",
  "off", "down", "high", "tall", "deep", "edge",
  "car", "vehicle", "bike", "bicycle", "bus", "ship", "boat", "submarine", "yacht",
  "catapult", "trebuchet", "slingshot",
  // size adjectives + container/report talk (recognized, no slot of their own)
  "tiny", "small", "medium", "large", "huge", "massive", "giant", "sized", "size",
  "cubic", "shape", "side", "amount", "generate", "report", "contain", "hold", "holds",
  "holding", "capacity", "volume", "litre", "liter", "litres", "liters", "gallon",
  "fit", "fits", "store", "stores",
  "height", "width", "length", "diameter",
]);

const SIZE_UNITS: [string, number][] = [["mm", 0.001], ["cm", 0.01], ["in", 0.0254], ["ft", 0.3048], ["m", 1], ["km", 1000]];
// Velocity units → m/s multiplier. Checked longest-first so "km/s" wins over "m/s".
const VEL_UNITS: [string, number][] = [
  ["km/s", 1000], ["km/h", 1 / 3.6], ["kph", 1 / 3.6], ["mph", 0.44704],
  ["ft/s", 0.3048], ["fps", 0.3048], ["cm/s", 0.01], ["mm/s", 0.001],
  ["m/s", 1], ["ms", 1], ["knots", 0.514444], ["knot", 0.514444], ["kn", 0.514444],
];
const HEIGHT_CUES = ["from", "above", "up", "high", "height", "altitude", "tall", "hovering", "dangle", "hanging",
  "sky", "skies", "air", "airborne", "cloud", "space", "orbit", "cliff", "tower", "bridge", "rooftop", "roof",
  "mountain", "hill", "balcony", "top", "peak", "summit", "ledge", "platform", "crane", "building",
  "drop", "dropped", "fall", "falling", "skydiving", "parachute", "off", "over"];
const SIZE_CUES = ["size", "sized", "wide", "thick", "thickness", "diameter", "across", "radius", "girth", "length", "long"];
const TARGET_CUES = ["in", "into", "onto", "on", "over", "through", "inside"];

const STOPWORDS = new Set([
  "a", "an", "the", "in", "on", "at", "of", "to", "into", "onto", "from", "and",
  "with", "please", "neo", "hey", "hi", "can", "you", "what", "happens", "if",
  "i", "want", "like", "me", "show", "do", "does", "is", "it", "this", "that",
  "there", "some", "over", "out", "up", "for", "we", "will", "would", "should",
  "could", "my", "by", "as", "or", "more", "than", "then", "when", "while", "able",
  "which", "was", "were", "been", "within", "without", "not",
  "has", "have", "had",
  // contraction fragments (tokenizer splits "can't" → "can"+"t")
  "wont", "don", "doesn", "isn", "aren", "wasn", "weren", "didn", "couldn",
  "shouldn", "wouldn", "hasn", "haven", "ll", "re", "ve",
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
  if (u) return u[1];
  if (unit === "mi") return 1609.34;
  if (unit === "yd") return 0.9144;
  return 1;
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// English morphology for understanding real sentences: plurals ("cubes",
// "tanks", "wires"), third-person verbs ("shatters", "melts", "drops"),
// -ies forms ("batteries"). Direct hits always win; stems are fallback.
function wordVariants(t: string): string[] {
  const out = [t];
  if (t.length > 4 && t.endsWith("ies")) out.push(t.slice(0, -3) + "y");
  if (t.length > 3 && t.endsWith("s")) out.push(t.slice(0, -1));
  if (t.length > 4 && t.endsWith("es")) out.push(t.slice(0, -2));
  return [...new Set(out)];
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
  /** True when the user wants a capacity report (how much a container holds). */
  reportCapacity: boolean;
  /** Fluid carried INSIDE the body ("cube filled with water", "bucket of lava"). */
  containedFluid: string | null;
  /** Extra bodies from conjunctions ("steel and glass") — staged + judged together. */
  multi: NeoPlan[];
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
  const exact = (v: string): { id: string; word: string } | null => {
    for (const k of keys) {
      if (v === k || v === MATERIALS[k].name.toLowerCase()) return { id: k, word: v };
    }
    if (MAT_ALIAS[v]) return { id: MAT_ALIAS[v], word: v };
    return null;
  };
  for (const t of tokens) {
    const hit = exact(t) ?? exact(wordVariants(t).find((v) => v !== t && exact(v)) ?? "");
    if (hit) return { ...hit, word: t };
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
    for (const v of wordVariants(t)) {
      if (FLUIDS[v]) return { id: v, word: t };
      if (FLUID_ALIAS[v] && FLUIDS[FLUID_ALIAS[v]]) return { id: FLUID_ALIAS[v], word: t };
    }
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
    for (const v of wordVariants(t)) {
      for (const s of SHAPES) if (s.words.includes(v)) return { shape: s.shape, word: t };
    }
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
    for (const v of wordVariants(t)) {
      for (const [action, verbs] of Object.entries(VERBS)) {
        if (verbs.includes(v)) return { action: action as NeoAction, word: t };
      }
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
export function neoParse(input: string, mem: NeoMemory | null = null, depth = 0): NeoPlan {
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
    if (tokens.some((t) => wordVariants(t).includes(k))) { planet = k; break; }
  }

  // Numbers with units, in string order. Long unit names first so the
  // regex never matches the "m" inside "meters". Velocity units (km/s, mph,
  // km/h, ft/s, knots…) are matched longest-first so "km/s" wins over "m/s".
  const nums: { value: number; unit: string; index: number }[] = [];
  const numRe = /(\d+(?:\.\d+)?)\s?(mm\/s|cm\/s|km\/s|ft\/s|km\/h|mm|cm|km|m\/s|kph|mph|fps|knots|knot|kn|°c|\bc\b|°f|\bf\b|\bk\b|°k|degrees|degree|deg|meter|metre|meters|metres|miles|mile|yards|yard|feet|foot|inches|inch|°|ft|in|c|f|k|m)\b/g;
  let m: RegExpExecArray | null;
  const normUnit = (u: string): string => {
    if (u === "meters" || u === "metres" || u === "meter" || u === "metre") return "m";
    if (u === "feet" || u === "foot") return "ft";
    if (u === "inches" || u === "inch") return "in";
    if (u === "miles" || u === "mile") return "mi";
    if (u === "yards" || u === "yard") return "yd";
    if (u === "knot" || u === "knots") return "kn";
    if (u === "f") return "°f";
    if (u === "c") return "°c";
    if (u === "degree" || u === "deg") return "degree"; // ambiguous — resolved below
    return u;
  };
  while ((m = numRe.exec(raw))) {
    nums.push({ value: parseFloat(m[1]), unit: normUnit(m[2]), index: m.index });
  }
  // Word numbers ("ten meters", "a hundred feet", "a thousand") → digits.
  const WORD_NUM: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
    forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, thousand: 1000,
  };
  const wordNumRe = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s?(mm|cm|km|m\/s|kph|mph|fps|knots|knot|kn|meter|metre|meters|metres|miles|mile|yards|yard|feet|foot|inches|inch|degrees|degree|deg|°|ft|in|m)\b/g;
  let wm: RegExpExecArray | null;
  while ((wm = wordNumRe.exec(raw))) {
    const v = WORD_NUM[wm[1]];
    const wIdx: number = wm.index ?? 0;
    if (v !== undefined && !nums.some((n) => Math.abs(n.index - wIdx) < 3)) {
      nums.push({ value: v, unit: normUnit(wm[2]), index: wIdx });
    }
  }
  nums.sort((a, b) => a.index - b.index);
  // Bare number after from/above ("drop a box from 100") = metres.
  const bareM = raw.match(/(?:from|above)\s+(\d+(?:\.\d+)?)(?![0-9a-z°/])/);
  if (bareM && !nums.some((n) => Math.abs(n.index - (bareM.index ?? -1)) < bareM[0].length + 2)) {
    nums.push({ value: parseFloat(bareM[1]), unit: "m", index: bareM.index ?? 0 });
    nums.sort((a, b) => a.index - b.index);
  }
  // Bare "degree/deg" is ambiguous ("100 degree heat" vs "45 degree launch"):
  // cue words in a ±28-char window decide temperature (°C) vs launch angle,
  // else the action decides (thermal verbs → temp, throw → angle).
  const TEMP_CUES = ["heat", "hot", "cold", "melt", "burn", "freeze", "boil", "temp", "warm", "cool", "chamber", "celsius", "fahrenheit", "kelvin", "weather", "climate"];
  const ANGLE_CUES = ["angle", "launch", "throw", "toss", "hurl", "shoot", "tilt", "slope", "incline", "traject", "arc", "aim", "cannon"];
  let degreeNote: string | null = null;
  for (const n of nums) {
    if (n.unit !== "degree") continue;
    const win = raw.slice(Math.max(0, n.index - 28), n.index + 28);
    const isTemp = TEMP_CUES.some((c) => win.includes(c));
    const isAng = ANGLE_CUES.some((c) => win.includes(c));
    const asTemp = isTemp || (!isAng && (action === "melt" || action === "burn" || action === "freeze" || action === "boil" || action === null));
    n.unit = asTemp ? "°c" : "degrees";
    if (asTemp) degreeNote = `${n.value} degrees read as °C (science default; say F for Fahrenheit).`;
  }
  const VEL_MS = new Map<string, number>(VEL_UNITS);
  const toVelMs = (n: { value: number; unit: string }): number | null => {
    const k = VEL_MS.get(n.unit);
    return k === undefined ? null : n.value * k;
  };
  // Temperature: °C direct, °F and K converted.
  const tempHitC = nums.find((n) => n.unit === "°c") ?? null;
  const tempHitF = nums.find((n) => n.unit === "°f") ?? null;
  const tempHitK = nums.find((n) => n.unit === "k" || n.unit === "°k") ?? null;
  const tempHit = tempHitC ?? (tempHitF ? { ...tempHitF, value: (tempHitF.value - 32) * 5 / 9, unit: "°c" } : null)
    ?? (tempHitK ? { ...tempHitK, value: tempHitK.value - 273.15, unit: "°c" } : null);
  const velNumHit = nums.find((n) => VEL_MS.has(n.unit)) ?? null;
  // Phrase velocities: "speed of light", "supersonic", "like a bullet"…
  // Real reference speeds (m/s), labelled measured/approx in the note.
  const PHRASE_VEL: [RegExp, number, string][] = [
    [/\bspeed of light\b|\blightspeed\b|\blight speed\b|\bc\b(?=\s|$)/, 299792458, "speed of light c = 299,792,458 m/s"],
    [/\bwarp\b|\bhyperdrive\b/, 299792458, "warp ≈ c (relativistic — capped at light speed)"],
    [/\bhypersonic\b/, 1700, "hypersonic ≈ Mach 5 ≈ 1,700 m/s"],
    [/\bsupersonic\b|\bbreak the sound barrier\b|\bsound barrier\b/, 400, "supersonic ≈ 400 m/s (just past Mach 1)"],
    [/\bmach\s?(\d+(?:\.\d+)?)/, 343, "Mach × 343 m/s"],
    [/\bsonic\b/, 343, "sonic = 343 m/s (speed of sound)"],
    [/\blike a bullet\b|\bbullet\b|\brifle\b|\bsniper\b/, 900, "rifle bullet ≈ 900 m/s"],
    [/\bjet\b|\bfighter\b|\bairliner\b|\bsupersonic jet\b/, 250, "jet ≈ 250 m/s"],
    [/\brocket\b|\bmissile\b/, 1500, "rocket ≈ 1,500 m/s"],
    [/\brace ?car\b|\bformula\b|\bf1\b/, 100, "race car ≈ 100 m/s"],
    [/\bcheetah\b|\bfast animal\b/, 30, "cheetah sprint ≈ 30 m/s"],
    [/\bthrow fast\b|\breally fast\b|\bsuper fast\b|\bultra fast\b|\bmega fast\b|\bvery fast\b|\bextremely fast\b|\bfast as\b/, 60, "fast throw ≈ 60 m/s (pro pitcher ×2)"],
    [/\bslow\b|\bgentle\b|\bsoft\b|\blight toss\b/, 2, "gentle toss ≈ 2 m/s"],
    [/\bcrawl\b|\bsnail\b/, 0.5, "crawl ≈ 0.5 m/s"],
    [/\bhuman throw\b|\bthrown by hand\b|\bby hand\b/, 20, "hand throw ≈ 20 m/s"],
    [/\bshotgun\b/, 400, "shotgun ≈ 400 m/s"],
    [/\bcannon\b|\bcannonball\b/, 300, "cannon ≈ 300 m/s"],
    [/\bslingshot\b|\bcatapult\b/, 50, "catapult ≈ 50 m/s"],
  ];
  let phraseVelMs: number | null = null, phraseVelNote: string | null = null;
  for (const [re, v, note] of PHRASE_VEL) {
    if (!note) continue;
    const mm = raw.match(re);
    if (mm) {
      if (re.source.includes("mach") && mm[1]) {
        phraseVelMs = parseFloat(mm[1]) * 343;
        phraseVelNote = `Mach ${mm[1]} ≈ ${phraseVelMs.toFixed(0)} m/s`;
      } else {
        phraseVelMs = v;
        phraseVelNote = note;
      }
      break;
    }
  }
  const velHit = velNumHit ? { value: toVelMs(velNumHit)!, unit: "m/s" } : null;
  const angHit = nums.find((n) => n.unit === "degrees" || n.unit === "°") ?? null;
  // Angle words: "straight up" = 90°, "flat/horizontal" = 0°.
  let angleWordDeg: number | null = null;
  if (/\bstraight up\b|\bvertical\b|\bvertically\b/.test(raw)) angleWordDeg = 90;
  else if (/\bflat\b|\bhorizontal\b|\bhorizontally\b|\blevel\b/.test(raw)) angleWordDeg = 5;
  else if (/\bdiagonal\b|\bdiagonally\b/.test(raw)) angleWordDeg = 45;
  const LENGTH_UNITS = new Set(["mm", "cm", "in", "ft", "m", "km", "mi", "yd"]);
  const lengths = nums.filter((n) => !["°c", "°f", "k", "°k", "degrees", "°", ...VEL_UNITS.map(([u]) => u)].includes(n.unit) && LENGTH_UNITS.has(n.unit));

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
  let sizeRawM: number | null = null, sizeExplicit = false;
  const used = new Set<number>();
  // Height cue: number AFTER from/above/up ("from 100m"), or just before
  // high/tall ("100m high"). Size cue: number EITHER side of a shape word
  // ("2m copper ball", "cube 2m") — adjectives may sit between.
  const after = (pos: number, cues: number[], within: number): boolean =>
    cues.some((c) => pos > c && pos - c <= within);
  const beside = (pos: number, cues: number[], within: number): boolean =>
    cues.some((c) => Math.abs(pos - c) <= within);
  const beforeWord = (pos: number, words: string[], within: number): boolean =>
    idxOf(words).some((c) => c > pos && c - pos <= within);

  for (const [i, L] of lengths.entries()) {
    if (after(L.index, heightIdx, 16) || beforeWord(L.index, ["high", "tall"], 8)) {
      if (heightM === null) { heightM = L.value * unitToM(L.unit); used.add(i); }
    } else if (beside(L.index, sizeIdx, 14)) {
      if (sizeM === 0.5 && !used.has(i)) {
        sizeRawM = L.value * unitToM(L.unit);
        sizeM = sizeRawM;
        sizeExplicit = SIZE_CUES.some((w) => raw.includes(w));
        used.add(i);
      }
    }
  }
  const rest = lengths.filter((_, i) => !used.has(i));
  const ballistic = action === "drop" || action === "throw" || action === "crush" || action === "blast";
  // Rescue: "throw a sphere 100m" — a >6 m number glued to a shape word is a
  // distance, not a 3 m-clamped monster. Read it as height, say so.
  let rescuedNote: string | null = null;
  if (heightM === null && ballistic && sizeRawM !== null && sizeRawM > 6 && !sizeExplicit) {
    heightM = sizeRawM;
    rescuedNote = `${sizeRawM} m read as height (too big for an object).`;
    sizeM = 0.5; sizeRawM = null;
  }
  if (heightM === null && rest.length && (ballistic || action === "float" || action === "sink")) {
    heightM = rest[0].value * unitToM(rest[0].unit);
    rest.shift();
  }
  if (sizeM === 0.5 && rest.length && !ballistic) {
    sizeM = rest[0].value * unitToM(rest[0].unit);
    rest.shift();
  }
  sizeM = Math.min(3, Math.max(0.05, sizeM));
  // Sky goes to 86 km (top of the US-1976 atmosphere model) — clamp loudly, never silently.
  const HEIGHT_MAX = 86000;
  let clampedNote: string | null = null;
  if (heightM !== null && heightM > HEIGHT_MAX) {
    clampedNote = `${heightM.toFixed(0)} m is above the 86 km atmosphere model — clamped to ${HEIGHT_MAX} m (airless above).`;
    heightM = HEIGHT_MAX;
  }
  if (heightM !== null) heightM = Math.min(HEIGHT_MAX, Math.max(0.5, heightM));
  else if (ballistic) heightM = action === "throw" ? 10 : 12;
  else if (action === "float" || action === "sink") heightM = 5;

  // Containers: size adjectives when no number, and a stated height doubles as
  // the container's size ("a container of height 1 meter" → 1 m box).
  const CONTAINER_WORDS = ["container", "vessel", "tank", "barrel", "bucket", "bin", "tub", "basin", "tray", "reservoir", "beaker", "cup", "mug", "pot", "drum", "bottle", "jar", "pail", "cask", "keg", "tote", "hopper", "silo", "cistern", "aquarium"];
  const containerWord = shapeHit && CONTAINER_WORDS.includes(shapeHit.word) ? shapeHit.word : null;
  let sizeNote: string | null = null;
  let adjApplied = false;
  if (sizeM === 0.5 && sizeRawM === null) {
    const SIZE_ADJ: [RegExp, number][] = [
      [/\btiny\b/, 0.15], [/\bsmall\b/, 0.3], [/\bmedium\b/, 0.8],
      [/\blarge\b/, 1.5], [/\bhuge\b/, 2.2], [/\bmassive\b/, 2.8], [/\bgiant\b/, 2.8],
    ];
    for (const [re, v] of SIZE_ADJ) {
      if (re.test(raw)) { sizeM = v; adjApplied = true; sizeNote = `${re.source.replace(/\\b/g, "")} ≈ ${v} m.`; }
    }
  }
  if (containerWord && sizeRawM === null && heightM !== null && (sizeM === 0.5 || adjApplied)) {
    sizeM = Math.min(3, Math.max(0.05, heightM));
    sizeNote = `container height ${heightM} m read as its size.`;
  }
  // Capacity intent: the user wants a holds-report, not just a splash.
  const reportCapacity = /\b(how much|hold|holds|holding|capacity|volume|litre|liter|litres|liters|gallon|report|fit|fits|contain|contains|store|stores)\b/.test(raw)
    && (containerWord !== null || action === "pour" || action === "build");

  // Effective velocity / angle / temperature (one truth for display + scenario).
  const effVelMs = velHit ? velHit.value : phraseVelMs ?? (action === "throw" ? 6 : null);
  const effAngleDeg = angHit ? angHit.value : angleWordDeg ?? (action === "throw" ? 25 : null);
  const effTempC = tempHit ? tempHit.value : null;

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
  // Containment: "a cube with water in it" — the fluid rides INSIDE the body,
  // so the world target stays ground and the fluid becomes cargo.
  let containedFluid: string | null = null;
  const vesselLike = shapeHit !== null || matHit?.id === "glass";
  if (fluidHit && vesselLike && (/\bwith\b|\bcontain|\bfill|\bfull of\b|\bhold/.test(raw) || /\bhas\b.*\bin\b|\bhave\b.*\bin\b/.test(raw))) {
    containedFluid = fluidHit.id;
    target = { kind: "ground", word: "ground" };
  }

  const material0 = matHit?.id ?? (action === "pour" && fluidHit ? "water" : "oak");
  // A vessel naming only its cargo gets a glass shell — transparent, so the fluid shows.
  const shellDefaulted = !!containedFluid && matHit?.id === containedFluid;
  const material = shellDefaulted ? "glass" : material0;
  const materialWord = shellDefaulted ? "" : (matHit?.word ?? "");
  const notes: string[] = [];
  if (rescuedNote) notes.push(rescuedNote);
  if (clampedNote) notes.push(clampedNote);
  if (sizeNote) notes.push(sizeNote);
  if (degreeNote) notes.push(degreeNote);
  if (containedFluid) notes.push(`${FLUIDS[containedFluid].name} rides INSIDE the ${shapeHit?.shape ?? "box"} — staged as shell + fluid core (no sealed vessels in-engine; they fly as one).`);
  if (shellDefaulted) notes.push("no shell material named — glass assumed (transparent, so the cargo shows).");
  if (/\b(not|never|cannot|n't)\b/.test(raw)) notes.push("negation noted — Neo judges the physical setup, not the grammar polarity.");
  if (phraseVelNote) notes.push(`speed read as ${phraseVelNote}.`);
  if (effVelMs !== null && effVelMs >= 299792458) notes.push("RELATIVISTIC: at light speed Newton breaks — the engine stages it Newtonian (no time dilation) so treat the arc as illustrative, not literal.");
  else if (effVelMs !== null && effVelMs > 3000) notes.push(`${effVelMs.toFixed(0)} m/s is hypersonic — drag will eat most of it; the sim shows how much.`);
  if (velNumHit && velNumHit.unit !== "m/s") notes.push(`${velNumHit.value}${velNumHit.unit} = ${toVelMs(velNumHit)!.toFixed(1)} m/s.`);
  if (tempHitF) notes.push(`${tempHitF.value}°F = ${effTempC!.toFixed(1)}°C.`);
  if (tempHitK) notes.push(`${tempHitK.value}K = ${effTempC!.toFixed(1)}°C.`);
  if (!act) notes.push("no action word found — Neo needs a verb like throw, melt, crush.");
  if (!matHit && action !== "pour") notes.push("no material named — assuming oak; say copper, glass, lead…");
  if (!shapeHit) notes.push("no shape named — assuming cube; say cube, sphere, ball…");
  if (rest.length) notes.push(`extra number(s) ignored: ${rest.map((r) => `${r.value}${r.unit}`).join(", ")}`);

  // Unknown tokens: candidates for learning (not stopwords, not matched).
  // Any known verb/shape word is never unknown, even when it isn't THE pick
  // ("melt … heat": heat is a melt verb too, not a mystery word).
  const VERB_WORDS = new Set(Object.values(VERBS).flat());
  const SHAPE_WORDS = new Set(SHAPES.flatMap((s) => s.words));
  const matched = new Set([
    act?.word, shapeHit?.word, matHit?.word, fluidHit?.word,
    ...(target.kind === "ground" && target.word !== "ground" ? [target.word] : []),
    planet !== "earth" ? planet : "",
  ]);
  const unknown = tokens.filter((t) =>
    !STOPWORDS.has(t) && !KNOWN_EXTRA.has(t) && !VERB_WORDS.has(t) && !SHAPE_WORDS.has(t) &&
    t.length > 2 && !matched.has(t) &&
    !/^\d/.test(t) && !["mm", "cm", "km", "ft", "in", "mi", "yd", "m", "c", "f", "k", "s", "ms",
      "m/s", "km/s", "ft/s", "cm/s", "mm/s", "km/h", "kph", "mph", "fps", "knot", "knots", "kn",
      "°c", "°f", "°k", "degrees", "degree", "deg", "meter", "metre", "meters", "metres", "miles", "mile", "yards", "yard",
      "feet", "foot", "inches", "inch"].includes(t));

  // Confidence: filled slots over needed slots, minus unknown-word penalty.
  const need = [act ? 1 : 0, matHit ? 1 : 0, shapeHit ? 1 : 0,
    (heightM !== null || tempHit || velHit || phraseVelMs !== null) ? 1 : 0,
    (fluidHit || target.word !== "ground") ? 1 : 0, planet !== "earth" ? 1 : 0];
  const filled = need.reduce((a, b) => a + b, 0);
  const confidence = Math.min(0.95, Math.max(0.3, 0.35 + filled * 0.12 - unknown.length * 0.04));

  // Multi-body: "drop steel and glass" — split on conjunctions, parse each
  // clause on its own, inherit the main action/height/speed/target when a
  // clause omits them. Only sim actions stage crowds; verdict families and
  // capacity reports stay single (their math is per-object).
  let multi: NeoPlan[] = [];
  const SIM_ACTIONS: (NeoAction | null)[] = ["drop", "throw", "crush", "blast", "slide", "build", "float", "sink", "pour"];
  if (depth === 0 && !reportCapacity && action && SIM_ACTIONS.includes(action)) {
    const clauses = raw.split(/\s*(?:,|\band\b|\bplus\b|&)\s*/).filter((c) => c.trim().length > 0);
    if (clauses.length > 1) {
      for (const cl of clauses.slice(0, 4)) {
        if (cl === raw) continue;
        const sub = neoParse(cl, mem, 1);
        if (!sub.action) { sub.action = action; sub.actionWord = act?.word ?? ""; }
        if (sub.heightM === null) sub.heightM = heightM;
        if (sub.velMs === null) sub.velMs = effVelMs;
        if (sub.angleDeg === null) sub.angleDeg = effAngleDeg;
        if (sub.target.kind === "ground" && sub.target.word === "ground" && target.kind === "fluid") sub.target = target;
        if (sub.planet === "earth" && planet !== "earth") sub.planet = planet;
        // A clause only counts when it names its own material or shape.
        if (!sub.materialWord && (sub.shapeWord === "cube" && !/\bcube\b/.test(cl))) continue;
        // Skip duplicates of the primary body.
        if (sub.material === material && sub.shape === (shapeHit?.shape ?? "box")) continue;
        multi.push(sub);
        if (multi.length >= 3) break;
      }
    }
  }

  const mat = MATERIALS[material] ?? MATERIALS.oak;
  const shapeWord = shapeHit?.word ?? "cube";
  const shape = shapeHit?.shape ?? "box";
  const objStr = [ `${mat.name} ${shape} (${(mat.density * (shape === "sphere"
    ? (4 / 3) * Math.PI * sizeM ** 3 : (2 * sizeM) ** 3)).toFixed(0)} kg, ${sizeM} m)`,
    ...multi.map((m) => m.steps[1][1]),
  ].join(" + ");
  const fmtVel = (v: number): string =>
    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M m/s` : v >= 10000 ? `${(v / 1000).toFixed(1)}k m/s` : `${+v.toFixed(1)} m/s`;
  const fromBits: string[] = [];
  if (reportCapacity && containerWord) fromBits.push(`${sizeM} m ${shape} container`);
  else if (heightM !== null) fromBits.push(`${heightM} m up`);
  if (effVelMs !== null) fromBits.push(fmtVel(effVelMs));
  else if (action === "throw") fromBits.push("6 m/s @ 25°");
  if (effAngleDeg !== null && effVelMs !== null) fromBits.push(`@ ${effAngleDeg}°`);
  else if (angHit) fromBits.push(`@ ${angHit.value}°`);
  if (effTempC !== null) fromBits.push(`${effTempC.toFixed(0)}°C`);
  if (altitudeM !== null) fromBits.push(`at ${altitudeM} m altitude (thin air)`);
  // Capacity preview, computed the same way the verdict computes it.
  let capacityPreview = "";
  if (reportCapacity) {
    const V = shape === "sphere" ? (4 / 3) * Math.PI * (sizeM / 2) ** 3 : sizeM ** 3;
    capacityPreview = `holds ≈ ${(V * 1000).toFixed(0)} L`;
  }
  const toStr = containedFluid
    ? `${FLUIDS[containedFluid].name} sealed inside the ${shape} → carried along → splash on impact`
    : reportCapacity && target.kind === "fluid"
    ? `${FLUIDS[target.fluid!].name} fill → ${capacityPreview} — full report below`
    : action === "dissolve" && acid
    ? `${acid} bath → corrosion timeline verdict`
    : target.kind === "fluid"
    ? `${FLUIDS[target.fluid!].name} pool → splash → ${mat.density < (FLUIDS[target.fluid!].density ?? 1e9) ? "float" : "sink"}`
    : "solid ground → impact vs strength";
  const steps: [string, string][] = [
    ["WHAT", act ? `${action} (“${act.word}”)${multi.length ? ` × ${multi.length + 1} bodies` : ""}` : "—"],
    ["OBJECT", objStr],
    ["FROM", fromBits.length ? fromBits.join(", ") : action === "melt" || action === "burn" || action === "boil" ? "heat chamber (pre-heated)" : "placed in the world"],
    ["TO", toStr],
  ];

  return {
    action, actionWord: act?.word ?? "", shape, shapeWord,
    material, materialWord,
    sizeM, heightM,
    velMs: effVelMs,
    angleDeg: effAngleDeg,
    tempC: effTempC,
    pourFluid: action === "pour" ? (fluidHit?.id ?? "water") : null,
    acid, altitudeM,
    reportCapacity, containedFluid, multi,
    target, planet, confidence, steps, notes, unknown,
  };
}

// ------------------------------------------------- sentence-space + dataset

/** How many distinct sentence structures Neo's grammar covers. */
export function neoPatternCount(): { total: number; breakdown: Record<string, number> } {
  const verbs = Object.values(VERBS).reduce((a, v) => a + v.length, 0) + 3; // + fire/blow up/set fire
  const shapes = SHAPES.reduce((a, s) => a + s.words.length, 0);
  const materials = Object.keys(MATERIALS).length + Object.keys(MAT_ALIAS).length;
  const sizeU = SIZE_UNITS.length + 2; // + miles, yards
  const heightU = SIZE_UNITS.length + 2;
  const velPhrases = 22; // lightspeed, mach, supersonic… + 13 velocity units
  const targets = 1 + Object.keys(FLUIDS).length + Object.keys(FLUID_ALIAS).length + GROUND_WORDS.length;
  const planets = Object.keys(PLANETS).length;
  const forms = 4; // statement, question, versus, capacity-report
  const bodies = 3; // single + multi-body crowds (1–3 extra bodies)
  const breakdown = { verbs, shapes, materials, sizeU, heightU, velPhrases, targets, planets, forms, bodies };
  const total = verbs * shapes * materials * sizeU * heightU * velPhrases * targets * planets * forms * bodies;
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
  const su = [...SIZE_UNITS.map(([u]) => u), "mi", "yd"];
  const planets = Object.keys(PLANETS);
  const velPhrases = ["at the speed of light", "at Mach 2", "supersonic", "like a bullet", "at 900 m/s", "at 60 mph", "at 250 km/h", "at 30 ft/s", "really fast", "gently"];
  const heights = ["from the sky", "from a cliff", "from a tower", "from orbit", "straight up", "from a bridge"];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i % 8;
    if (t === 0) {
      out.push(`${pick(verbs)} a ${(rnd() * 9 + 0.1).toFixed(1)}${pick(su)} ${pick(mats)} ${pick(shapes)} from ${(rnd() * 190 + 5).toFixed(0)}m in the ${pick(targets)}`);
    } else if (t === 1) {
      out.push(`${pick(verbs)} the ${pick(mats)} ${pick(shapes)} in ${pick(targets)}`);
    } else if (t === 2) {
      out.push(`does ${pick(mats)} melt at ${(rnd() * 1500 - 100).toFixed(0)}C`);
    } else if (t === 3) {
      out.push(`throw a ${pick(mats)} ${pick(shapes)} ${pick(velPhrases)} ${pick(heights)} into the ${pick(targets)} on ${pick(planets)}`);
    } else if (t === 4) {
      out.push(`can ${pick(mats)} survive a ${(rnd() * 400 + 1).toFixed(0)}m fall on ${pick(planets)}`);
    } else if (t === 5) {
      out.push(`${pick(verbs)} ${pick(mats)} at ${(rnd() * 2000 - 200).toFixed(0)}F`);
    } else if (t === 6) {
      out.push(`${pick(mats)} vs ${pick(mats)}: which is stronger`);
    } else {
      out.push(`will a ${pick(mats)} ${pick(shapes)} survive a ${(rnd() * 100 + 1).toFixed(0)}m fall`);
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
  if (plan.reportCapacity) {
    return { tool: "verdict", why: "capacity report — interior volume × fluid density, closed form" };
  }
  if (plan.multi.length > 0) {
    return { tool: "scenario", why: `rigid-body sim × ${plan.multi.length + 1} bodies: gravity, drag, impact stress each at 120 Hz` };
  }
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
    case "orbit":
      return { tool: "verdict", why: "circular orbit velocity + period from GM — closed form (flat plane cannot fly orbits)" };
    case "float": case "sink": case "pour":
      return { tool: "scenario", why: "fluid sim: buoyancy + viscosity integrated at 120 Hz" };
    default:
      return { tool: "scenario", why: "rigid-body sim: gravity, drag, impact stress at 120 Hz" };
  }
}

/** Actions judged by closed-form experience() instead of a drop scenario. */
export function neoNeedsExperience(plan: NeoPlan): boolean {
  if (plan.multi.length > 0) return false; // crowds always go live
  return plan.reportCapacity
    || plan.action === "electrify" || plan.action === "dissolve"
    || plan.action === "lase" || plan.action === "roll" || plan.action === "orbit";
}

/** Build the deterministic scenario this plan stages + judges (one parse, one truth). */
export function neoScenario(plan0: NeoPlan): ScenarioDesc {
  const bodies: NonNullable<ScenarioDesc["bodies"]> = [];
  const checks: NonNullable<ScenarioDesc["checks"]> = [];
  const all = [plan0, ...plan0.multi];
  for (const [bi, plan] of all.entries()) {
  const mat = MATERIALS[plan.material] ?? MATERIALS.oak;
  const H = plan.heightM ?? 10;
  const at = (c: NonNullable<ScenarioDesc["checks"]>[number]): void => {
    // Body index travels with the check so multi-body verdicts judge each body.
    checks.push(all.length > 1 ? { ...c, body: bi } as typeof c : c);
  };
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
      at({ kind: "survives-fall", heightM: H });
      // Thrown INTO a hot fluid? The verdict must judge the cooking too.
      if (plan.target.kind === "fluid" && plan.target.fluid && (FLUIDS[plan.target.fluid]?.tempC ?? 0) >= 500) {
        at({ kind: "floats-in", fluid: plan.target.fluid });
      }
      break;
    case "crush":
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 2 });
      bodies.push({ shape: "box", material: "steel", sizeM: 1.5, heightM: H });
      at({ kind: "survives-fall", heightM: H });
      break;
    case "blast":
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 30, vel: [0, -25, 0] });
      at({ kind: "survives-fall", heightM: 30 });
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
      if (mat.mohs !== undefined) at({ kind: "scratch", tool: plan.material, target: "quartz" });
      break;
    case "melt": case "burn": case "boil": {
      const demo = plan.tempC ?? mat.meltC ?? mat.ignitionC ?? 500;
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 1, tempC: demo + 50 });
      at({ kind: "melt-at", tempC: demo + 50 });
      break;
    }
    case "freeze":
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: 1, tempC: -30 });
      break;
    case "float": case "sink": case "pour": {
      const fluid = plan.target.kind === "fluid" ? plan.target.fluid! : "water";
      bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: H });
      at({ kind: "floats-in", fluid });
      break;
    }
      default:
        bodies.push({ shape: plan.shape, material: plan.material, sizeM: plan.sizeM, heightM: H });
        at({ kind: "survives-fall", heightM: H });
        if (plan.target.kind === "fluid" && plan.target.fluid && (FLUIDS[plan.target.fluid]?.tempC ?? 0) >= 500) {
          at({ kind: "floats-in", fluid: plan.target.fluid });
        }
    }
    // Sealed cargo: a ghost fluid core riding inside the shell — same
    // ballistics (shell-matched mass), no contact eject. The verdict judges
    // the shell; the core splashes live in the world.
    if (plan.containedFluid && (plan.action === "drop" || plan.action === "throw" || plan.action === null)) {
      const shellMass = (MATERIALS[plan.material] ?? MATERIALS.oak).density
        * (plan.shape === "sphere" ? (4 / 3) * Math.PI * plan.sizeM ** 3 : (2 * plan.sizeM) ** 3);
      const core: NonNullable<ScenarioDesc["bodies"]>[number] = {
        shape: plan.shape, material: MATERIALS[plan.containedFluid] ? plan.containedFluid : "water",
        sizeM: plan.sizeM, heightM: H, ghost: true, massKg: shellMass,
        dragProfile: plan.shape === "sphere" ? "sphere" : "cube",
      };
      if (plan.action === "throw") {
        core.vel = [
          (plan.velMs ?? 6) * Math.cos(((plan.angleDeg ?? 25) * Math.PI) / 180),
          (plan.velMs ?? 6) * Math.sin(((plan.angleDeg ?? 25) * Math.PI) / 180), 0,
        ];
      }
      bodies.push(core);
    }
  } // end per-body staging
  return {
    env: plan0.planet, durationS: 10, bodies, checks,
    ...(plan0.altitudeM !== null ? { airDensity: altitudeDensity(plan0.altitudeM) } : {}),
  };
}
