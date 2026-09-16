// aiPlayer — an AI that plays like a normal player, with a normal player's
// hands. It may ONLY: hold movement keys, look around, jump, press Ask, press
// Run. It may NEVER: teleport, call engine tools, mutate the world, read
// hidden state, or run terminal commands. Enforcement is by construction —
// the driver outputs keys + look targets + button-text, and App executes
// those through the exact same handlers the human UI uses.
//
// This file is DOM/three-free (pure math + state) so headless testers can
// drive it in node and verify it plays correctly without a screen.
export interface AiBody { x: number; z: number; top: number; massKg: number }
export interface AiState {
  px: number; pz: number; feetY: number;
  bodies: AiBody[];
  arousal01: number; tempC: number; storm: boolean;
}
export interface AiKeys { f: boolean; b: boolean; l: boolean; r: boolean; run: boolean; crouch: boolean; jump: boolean }
export interface AiOutput {
  keys: AiKeys; lookX: number; lookZ: number;
  say: string | null; run: string | null; note: string;
}
export interface AiMemory {
  lastPos: { x: number; z: number }; stuckT: number;
  lastJumpT: number; lastSayT: number; lastRunT: number;
  lastNote: string; targetIdx: number; now: number;
}

export const freshAiMemory = (now: number): AiMemory => ({
  lastPos: { x: 0, z: 0 }, stuckT: 0,
  lastJumpT: -999, lastSayT: -999, lastRunT: -999,
  lastNote: "waking up", targetIdx: 0, now,
});

const still = (): AiKeys => ({ f: false, b: false, l: false, r: false, run: false, crouch: false, jump: false });

/** Nearest body worth walking to (prefers light, near, visible things). */
function pickTarget(s: AiState, mem: AiMemory): AiBody | null {
  if (!s.bodies.length) return null;
  const scored = s.bodies
    .map((b) => {
      const d = Math.hypot(b.x - s.px, b.z - s.pz);
      return { b, d };
    })
    .filter((e) => e.d > 0.6);
  if (!scored.length) return null;
  scored.sort((a, b2) => (a.d + (a.b.massKg > 500 ? 25 : 0)) - (b2.d + (b2.b.massKg > 500 ? 25 : 0)));
  return scored[mem.targetIdx % scored.length].b;
}

/** One drive step. Pure: no I/O, no world access, no commands. */
export function aiStep(s: AiState, mem: AiMemory, idea: string | null): AiOutput {
  const keys = still();
  const dt = 0.25;
  // Stuck detection: same spot for 3 s → hop + pick a new target.
  const moved = Math.hypot(s.px - mem.lastPos.x, s.pz - mem.lastPos.z);
  if (moved < 0.2) mem.stuckT += dt;
  else { mem.stuckT = 0; mem.lastPos = { x: s.px, z: s.pz }; }
  if (mem.stuckT > 3) {
    mem.stuckT = 0;
    mem.targetIdx++;
    mem.lastJumpT = mem.now;
    return { keys: { ...keys, jump: true }, lookX: s.px + 5, lookZ: s.pz, say: null, run: null, note: "stuck — hopping free" };
  }
  const target = pickTarget(s, mem);
  if (!target) {
    // Empty plane: wander in a slow arc, take in the sky.
    return { keys: { ...keys, f: true }, lookX: s.px + 10, lookZ: s.pz + 4, say: null, run: null, note: "wandering the open plane" };
  }
  const d = Math.hypot(target.x - s.px, target.z - s.pz);
  const heavy = target.massKg > 120;
  let say: string | null = null;
  let run: string | null = null;
  if (d > 2.2) {
    keys.f = true;
    if (d > 12) keys.run = true;
    // Chatty while walking: ask about the felt world, never canned answers.
    if (mem.now - mem.lastSayT > 30) {
      mem.lastSayT = mem.now;
      say = s.storm ? "this storm is wild — how strong is the wind right now?"
        : s.tempC > 30 ? "it feels hot out here — what is the temperature?"
        : "what is around us right now?";
    }
  } else if (target.top < 1.0 && mem.now - mem.lastJumpT > 4) {
    // Low obstacle: hop it like a player would.
    mem.lastJumpT = mem.now;
    keys.f = true; keys.jump = true;
    return { keys, lookX: target.x, lookZ: target.z, say: null, run: null, note: `jumping the ${target.top.toFixed(1)} m obstacle` };
  } else if (heavy) {
    // Too heavy to shove: stop, stare, consider an experiment instead.
    if (mem.now - mem.lastRunT > 50 && idea) {
      mem.lastRunT = mem.now;
      run = idea;
      return { keys, lookX: target.x, lookZ: target.z, say: null, run, note: "too heavy to push — running an experiment instead" };
    }
    return { keys, lookX: target.x, lookZ: target.z, say: null, run: null, note: `studying the heavy object (${Math.round(target.massKg)} kg, not pushing it)` };
  } else {
    // Shoveable: walk into it and feel the weight.
    keys.f = true;
    return { keys, lookX: target.x, lookZ: target.z, say: null, run: null, note: "pushing it — feeling the weight" };
  }
  return { keys, lookX: target.x, lookZ: target.z, say, run, note: d > 12 ? "running toward something interesting" : "walking over for a closer look" };
}
