# GAMEPLAY.md — the AI tester's playbook

> For any AI asked to "playtest NeoGenesis": play it like a real tester, not
> a code reader. Every function, every step, every small detail. This file is
> the checklist; `NEOGENESIS_RULES.md` is the law.

## 1. How to play (player hands only)

You get exactly what a human gets — nothing else. Forbidden while testing:
terminal-command cheats that bypass physics, direct world mutation, engine
tool calls that skip the game loop, teleporting to avoid walking.

1. **Move**: `frontend/src/three/player.ts` via `buildColliders` + `update`.
   Walk (4.2 m/s), run (Shift, 7.5 m/s), crouch (C), jump (Space, ~1.1 m).
2. **Talk**: Neo bar Ask button → `GameCtx.chat`. **Experiment**: Run ▶
   button → `GameCtx.runExperiment`, or the X Experience Lab panel.
3. **Inspect**: B brain visualizer, `` ` `` terminal (`help` lists commands),
   J journal. G demo mode hands your body to `aiPlayer.ts` — watch it play.
4. **Feel**: the HUD (position, altitude, temperature, clock, weather).

## 2. The full test sweep (do ALL of it, in order)

### A. Movement & collider (`player.ts`, `buildColliders`)
- [ ] Walk into a staged crate → you stop, it shoves aside if light.
- [ ] Walk into a lead block / tank wall → blocked dead, zero slide-through.
- [ ] Jump (Space) over a ≤1 m crate → clean pass, no clip, no launch.
- [ ] Jump onto a crate → you land ON it; walk off → you fall.
- [ ] Push a ~50 kg box → it slides; push a 500 kg block → it ignores you.
- [ ] Ghost cargo cores never block (no invisible walls).
- [ ] Pass criteria: no tunneling, no jitter at rest, no phantom pushes.

### B. Experiments (Neo bar, X lab, `runExperiment`)
- [ ] Every Experience Lab preset runs: rig stages live, verdict renders.
- [ ] `throw a copper sphere from 100m in the water` → splash, float/sink call.
- [ ] `melt a lead cube in lava` → heat chamber, melt event, glowing puddle.
- [ ] `a volcano erupting with a huge box on it` → lava pool + 8 bombs + box.
- [ ] `can a human lift 300kg on Earth` → verdict, no staging, no crash.
- [ ] `drop a copper box with oil` → cargo glass shell, ground target.
- [ ] Run ▶ on pure chat ("hello") → judged without staging, never empty.
- [ ] Pass criteria: staged matches verdict; lines narrate every body.

### C. Neo talks (`neoMind.ts`, `neoBrain.ts`, `neoBody.ts`, `neoMemory.ts`)
- [ ] "what is the temperature?" → true live numbers, full surroundings.
- [ ] Same question twice → different wording, same facts.
- [ ] "my name is X" → remembered next session (localStorage).
- [ ] "remember the storm scares me" → storm answers carry the belief later.
- [ ] `think <q>` shows salience, token probabilities, threat focus.
- [ ] `dream` replays episodes, forms beliefs only from repeated evidence.
- [ ] Inject HR 180 → replies quicken, mood bends; `inject clear` restores.
- [ ] `profile feral` warps wording live; unknown profile rejected.
- [ ] Pass criteria: zero canned replies; zero hallucinated numbers.

### D. Visualizer + terminal (B panel, `` ` `` terminal)
- [ ] B shows live HR/temp/VAD/mood, token stream, thought log, injector.
- [ ] `sense`, `inner`, `dream`, `think`, `profile`, `inject`, `fun` all answer.
- [ ] `fun` → meteors/anvils/shower/eruption with impacts + particles.
- [ ] `model-get 4242` → NEO-5243; `model-count` → 19,200,000.
- [ ] Pass criteria: every number matches the world; synthetic labels shown.

### E. Demo mode (G key, `aiPlayer.ts`)
- [ ] G → banner + AI LIVE feed; AI walks, jumps obstacles, pushes crates.
- [ ] AI chats and runs experiments through Ask/Run paths only.
- [ ] Any key → instant handoff, no stuck keys, no drift.
- [ ] Pass criteria: 5 minutes unattended, no errors, no stuck loops.

### F. Performance & nonsense watch (always on)
- [ ] 60 fps feel: fixed-step sim, no per-frame allocs, delta-gated body.
- [ ] Spawn spam → clean "body budget exceeded" past 500, never a slide-show.
- [ ] NaN injection (bad spawn args) → body frozen + logged, sim continues.
- [ ] Resting bodies reach exact zero velocity AND zero spin.
- [ ] Tumbling boxes rotate live; rolling balls roll (spin matches v/r).
- [ ] High drops fall faster than sea-level air allows (thin-air proof).
- [ ] Pass criteria: nothing moves that shouldn't; nothing stops that shouldn't.

## 3. Findings format (file them like this)

```
FINDING [area] severity(1-5): one-line symptom
  repro: exact steps / prompt / command
  expected: ... / observed: ...
  evidence: test output, trace line, or screenshot description
```

## 4. The upgrade loop (how AI improves the game)

1. Play the sweep above. File findings in the format.
2. Fix at the root (engine law or UI wiring — never a special-case hack).
3. Add/extend a check: engine → `engine/test/run-tests.mts`; player/mind
   logic → a temporary `*.proof.mts` (run it, then DELETE it).
4. Re-run: full engine suite + `npm run typecheck` + frontend build.
5. Update docs that quote changed behavior (`SCIENTIFIC_ASSUMPTIONS.md`,
   `AGENTS.md`, registry counts everywhere they appear).
6. Never weaken a tolerance to turn red green. Never add a canned reply.
   Never touch the hot loop without measuring.
