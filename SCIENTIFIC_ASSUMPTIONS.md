# SCIENTIFIC_ASSUMPTIONS.md — NeoGenesis lab

> A plane laboratory, not a planet. Everything below states what is measured,
> what is approximated, and what is gameplay-tuned. Tuned values are labeled
> in-source, same rule as the engine.

## 1. The lab environment (only one)

**`laboratory-earth` — sea-level standard air under a real sun.**

- Air: N₂ ~78%, O₂ ~21%, Ar ~1%, CO₂ ~1000 ppm at 1013 hPa. Day length 24 h,
  obliquity 23.44°. The sky keeps real solar/lunar position math because
  time-of-day is a lab condition (night changes survival and visibility).
- Humans: **exactly one** (the player). No NPCs. Hard rule (`ONE_HUMAN_RULE`).
- There are no eras, no biomes, no vegetation, no fauna. Anything claiming
  otherwise elsewhere in old docs is stale — this file is the truth.

## 2. Atmospheric assumptions
- Rendering uses physically *inspired* Rayleigh + Mie scattering with
  artist-tuned coefficients, not a full radiative-transfer solve.
- Weather (clear/rain/storm) is a lab condition: wind/rain readouts, ambient
  temperature that can genuinely melt ice. Not a GCM.

## 3. What the engine simulates (and how honestly)
- Rigid bodies at 120 Hz: gravity, quadratic drag (wind-relative, transonic
  Cd bump approx), buoyancy + viscosity in fluid volumes, Magnus lift for
  spinning bodies (approx, no tumbling), bounce/friction (pair-averaged
  restitution with a tuned ground partner), body-vs-body contact (impulse,
  pair restitution, fracture), CCD-lite substeps against tunneling,
  shatter vs ultimate strength, melt vs melt point, ignition vs ignition
  point. All from codex tables except labeled tuned/approx items.
- Slosh in carried vessels is a spring-damper tether (approx pendulum, not
  CFD): fill fraction sets cargo mass and tether looseness. Wind is a bulk
  air vector in every drag term. Bodies still do not tumble and fast bodies
  past ~3 km/s / 32 substeps can still tunnel — disclosed in `docs/WORLD.md`.
- No freeze kinetics, no corrosion kinetics: cold is staged, corrosion is a
  table timeline. Both labeled at staging time, never faked.
- Heat transfer is real but lumped: convection in the surrounding medium
  (still air 10, water 800, lava 500 W/m²·K) + Stefan-Boltzmann radiation with
  tabulated emissivity, integrated per body with its mass and specific heat.
  Uniform body temperature is assumed; conduction *within* bodies and phase-change
  kinetics are not modeled (fusion energy is quoted, not timed).

## 4. Data certainty tiers (load-bearing)
- **measured**: handbook/reference values (NIST, CRC, ISA, IAEA…).
- **approx**: real ranges with a picked midpoint (lava viscosity, drag of odd
  profiles…).
- **gameplay-tuned**: invented for feel and LABELED (only `restitution`, plus
  a few survival rates). Tuned values never pose as measurements.

## 5. Scientific uncertainties (honest list)
1. Midpoint picks inside real ranges (lava viscosity 100–100000 → 1000).
2. Corrosion timelines marked approx — order-of-magnitude correct, not lab-grade.
3. Acoustic damping at exactly 1 kHz — nearby frequencies differ.
4. Human-record thresholds (deadlift, sprint) move as records move.
5. Heating times carry ±50% (convection coefficient dominates) — quoted on every verdict.
6. High-altitude ballistics fly constant-g with a quoted gravity-at-release caveat.
7. Sound uses dry-air c(T); thin CO₂ atmospheres (Mars) are flagged MIXED, not faked.
8. The `validate` tool re-certifies integration error on demand (currently ≤0.3%).

## 6. Gameplay simplifications (load-bearing)
- Detail follows the player: the staged rig and its neighborhood are high-fidelity;
  there is no planet to stream.
- Survival: hunger/thirst/temperature/stamina/health/sleep simplified to readable rates;
  no medical simulation.
- Time: real solar position math (NOAA-style), day length fixed at 24 h.
- Moon: real phase/geometry math, simplified ephemeris (low-precision lunar theory, ±arcmin).
- Multiplayer: forbidden (ONE HUMAN rule); saves are keyed by `playerId` anyway.
- Persistence: player state/journal saved locally; nothing else stored.

## 7. What we will never claim
- That a verdict is exact when its inputs are approx or tuned.
- That missing data is anything but MISSING (MIXED + named gap, never guessed).
- That the plane is a planet, or that any removed Earth-game doc describes the game.
