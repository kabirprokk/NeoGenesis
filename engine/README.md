# @neogenesis/engine — the reality engine

A standalone, dependency-free physics + material simulation engine. It runs the game,
and it is also the instrument by which an AI can *feel* things: a prompt goes in,
the engine lives it with real numbers, and a verdict comes out.

## The invention loop
```
prompt ("drop an oak crate from 100m")
  → experience() builds bodies from the 19.2M-model registry
  → EngineWorld steps real gravity, drag, impact stress, melt, friction
  → verdict: REAL / NOT REAL / MIXED + measurements + sensory trace + reasons
```
An AI agent "experiences" the scenario through the trace (position, velocity,
temperature, break/melt/ignite events per timestep) and judges reality against
measured thresholds — never vibes. `MIXED` with a named gap beats a guessed REAL.

## Use
```powershell
npm test                                              # 23 physics checks
npm run experience -- "can a human lift 300kg"        # natural prompt
npm run experience -- "throw a steel sphere at 30 m/s 45 degrees on Mars"
echo '{"bodies":[{"material":"glass","heightM":50}],"checks":[{"kind":"survives-fall","heightM":50}]}' | npm run experience -- --json
```

## Contents
- `constants.ts` — g, c, G, atm, terminal velocity… (codex table 1)
- `materials.ts` — 24 real materials, 9 fluids, drag table, Mohs ladder, explosives,
  friction pairs, repose angles, stars, gases (tables 3–25). Only `restitution` is
  tuned (bounce is a pair property); everything else is table data.
- `planets.ts` — 12 bodies, gravity/pressure/temperature/hazards (tables 2+8)
- `physics.ts` — closed-form: terminal velocity, range, impact pressure, Mohs,
  buoyancy, sound delay, incline slide, repose, viscous drag
- `world.ts` — flat plane world, 120 Hz fixed step, deterministic; bounce/friction/
  shatter/melt/ignite verdicts live here
- `models.ts` — 19,200,000 deterministic registry entries (24 classes × 20 materials ×
  16 sizes × 10 configs × 10 fills × 25 cosmetic liveries), addressable by index, spawnable into any world
- `experience.ts` — prompt parser (7 scenario families) + JSON scenario runner
- `cli.ts` — terminal interface for humans and agents alike
