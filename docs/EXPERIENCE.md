# EXPERIENCE LAB — the invention: an AI that feels before it judges

A prompt goes in. The reality engine lives it — 120 Hz fixed-step, real gravity,
real drag, real impact stress, real melt points, real friction, any of 12 planets.
A verdict comes out: **REAL / NOT REAL / MIXED**, with measurements, a sensory
trace, and numbered reasons.

## Human loop (in-game)
- Press **X**: Experience Lab panel with one-click preset prompts.
- Press **`~`**: terminal. `do <experiment>` STAGES it live — a glass tank is built,
  real fluid poured, the body placed 10 m up and released in front of you, with
  `watch` streaming splash/float/sink/shatter events as they happen.
  `verdict <prompt>` judges without staging; `spawn-body gold 1` drops 154 t of
  gold in front of you; `gravity mars` retunes the live world; `tool <name> <json>`
  calls any of the 36 engine tools head-on; `ai <question>` runs the lab assistant.

## Agent loop (headless, preferred for AI)
```powershell
cd C:\NeoGenesis\engine
npm run experience -- "does steel scratch quartz"
echo '{"env":"mars","bodies":[{"material":"oak","heightM":50}],"checks":[{"kind":"survives-fall","heightM":50}]}' | npm run experience -- --json
```
JSON scenarios give full control: bodies (shape/material/size/height/velocity/
temperature), environment preset or raw gravity/air/ambient, duration, and explicit
checks (`survives-fall`, `floats-in`, `scratch`, `melt-at`, `hear-at`).

## The 10,000+ models
`engine/src/models.ts` holds a deterministic 12,000-entry registry (12 classes ×
10 materials × 10 sizes × 10 configs): `getModel(i)` / `spawnModel(world, i)` —
identical physics every time, no storage. The old 105-variant matrix
(`neo_genesis_model_matrix.json`) is its ancestor, kept untouched.

## Honesty policy (load-bearing)
- REAL only when numbers clear documented thresholds (ultimate strength, melt
  point, Mohs rule, terminal velocity, friction cone…).
- MIXED with a named gap beats a guessed REAL. Missing data is reported, e.g.
  buoyancy in fluids without density data, scratch tests without Mohs data.
- Only `restitution` is tuned (bounce is a pair property); everything else is
  codex table data. Tuned values are labeled in-source.
- 23 automated checks (`npm test`) pin: 9.80665, human terminal ≈54 m/s,
  30 m/s @45° → 91.7 m, steel↔glass mutual abrasion, corundum scratches quartz,
  oak floats / lead sinks, 3.43 km sound = 10 s, ice slides / rubber grips at 20°,
  dry sand avalanches past 35°, TNT tier, glass shatters from 50 m, oak survives 3 m.
