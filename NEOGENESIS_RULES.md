# NEOGENESIS_RULES.md — read this first, every time

> You are working on **NeoGenesis**: a browser physics laboratory.
> One human. One flat solid plane. Real numbers. An in-world AI (Neo) that
> turns sentences into live experiments with measured verdicts.
> If a request conflicts with the laws below, the laws win — say so plainly.

## 1. What the game is (30 seconds)

- A flat solid proving ground (`y=0`, 4 km across, follows the player).
- The **physics is the content**: gravity, drag, impact stress, melt points,
  conductivity, corrosion timelines — every experiment runs on real numbers.
- **Neo** lives in the world: a generative, self-learning local mind
  (`frontend/src/lab/neoMind.ts` + `neoBrain.ts` + `neoBody.ts` + `neoMemory.ts`).
  No network, no API, no weights. Novel wording every reply; live numbers pass
  through verbatim so they can never be hallucinated.
- Persistence is 100% browser-local (localStorage). No server, no database,
  no Docker, no Python runtime. The engine is dependency-free TypeScript.

## 2. Laws that NEVER change

1. **ONE HUMAN.** No NPCs, no creatures, no agents with bodies. Bodies and
   tools are objects. Never add anything that walks, talks, or acts in-world
   except the player and Neo's voice/rigs.
2. **No eras, no biomes, no vegetation, no fauna.** The plane is the world.
3. **Honesty over spectacle.** Missing data returns MIXED with the gap named —
   never guessed, never faked. Only `restitution` is tuned (labeled in-source);
   everything else is codex table data. New approximations must be labeled
   `approx` and disclosed in `SCIENTIFIC_ASSUMPTIONS.md`.
4. **Determinism.** Same index → same model. Same prompt → same verdict.
   No `Math.random` in engine code paths (visual-only renderer jitter excepted).
5. **Browser-local.** No network calls, no API keys, no backend, no new
   runtime dependencies for the engine. Frontend stays Vite + React + Three.js.
6. **Tests stay green.** `npm test` in `engine/` must pass fully before you
   finish. Add a check when you add physics. Never weaken a tolerance to make
   red green — fix the model or the test's expectations with justification.
7. **Docs stay true.** Changing physics? Update `SCIENTIFIC_ASSUMPTIONS.md`,
   and any file that quotes the old numbers (registry counts live in
   `AGENTS.md`, `engine/README.md`, `docs/EXPERIENCE.md` — keep them in sync).

## 3. Reading order for any task

1. This file. 2. `README.md` (controls, quick start). 3. `ARCHITECTURE.md`
   (frame data flow, budgets). 4. `SCIENTIFIC_ASSUMPTIONS.md` (what is
   measured vs tuned — read before touching numbers). 5. `AGENTS.md` (the 36
   engine tools + 8 skills and when to use them).

## 4. How to work here

- **Verify by execution.** Run the code, run the suite, run the build. Never
  claim green from memory. Proof scripts (`*.proof.mts`) are temporary: run
  them, then delete them.
- **Small, honest diffs.** Prefer editing existing files. Never invent URLs,
  datasets, or model capabilities. If the environment can't do something
  (exact human-brain replica, LLM weights, Python), say so and build the
  closest real thing inside these constraints.
- **Neo's voice is generated, not scripted.** Never add canned reply tables.
  Facts inject verbatim; wording samples from the learned model. Lessons and
  beliefs must be *earned* (repeated, valence-consistent episodes) — never
  hardcoded strings like `Avoid X`.
- **Performance is a feature.** Fixed-step sim decoupled from frame rate; no
  per-frame allocations in the hot loop; cognition off the hot loop
  (delta gates, idle dreams). Measure before adding workers/threads.
- **Ask when torn.** If a request pits spectacle against a law, or needs a
  judgment call you cannot verify, ask the user with options.

## 5. Mutable zones (safe to extend)

- More verbs/materials/fluids/tables with codex sources named.
- More registry axes (physical axes move numbers; cosmetic axes labeled).
- More skills under `skills/` following the existing format.
- More Neo senses, profiles, and visualizer panels — all local, all gated.
