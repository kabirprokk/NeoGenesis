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

## Neo — the in-world AI (`engine/src/neo.ts`, no AI API)

Type in the Neo bar (top of the screen), the Experience Lab (X), or the
terminal (`do …`). One flow everywhere: `runExperiment()` parses the sentence
into WHAT → OBJECT → FROM → TO, builds the rig in the live world, steps you
back to face it, streams engine events live, then judges the same scenario it
staged — verdict and visuals can never disagree.

- Grammar: ~50 verbs (throw/yeet, melt, crush, blast, build, pour…), 13 shapes,
  24 materials + aliases, mm/cm/m/km/ft/in units, ground + 9 fluids + planets.
  `neoPatternCount()` proves 10,000+ sentence structures; `neoSamples(seed, n)`
  materializes deterministic examples. Typo-tolerant (Levenshtein ≤ 2).
- Tools: `neo-parse` (plan + tool choice), `neo-scenario` (scenario JSON),
  `neo-samples` — Neo visibly picks `verdict` (thresholds) vs `scenario`
  (120 Hz sim) per action.
- Memory: every run is learned into localStorage (`neo-memory-v1`) — your words
  override the grammar after 2 uses, unknown words are counted for review.
  No network, no API keys, fully browser-local.

## Data-set-1 — codex II (`engine/src/science.ts`, raw: `engine/data/data-set-1.txt`)

12 more tables Neo feels: electrical (14 entries), acid corrosion timelines
(5 acids × steel/alu/titanium/glass/flesh), ISA air density 0–12 km, optics
(Snell), rolling resistance (11 pairs), surface tension, thermal expansion,
acoustic damping, isotopes (dose), gas toxicity (CO/H₂S/mercury), human limits
(500 kg deadlift, 45 kg carry, LD50 fall ≈ 12 m). New verbs: `electrify`,
`dissolve`, `lase`, `roll`, plus `at Xm altitude` thins the air in ballistics.
Strength data filled for all core materials (lead 18 MPa, concrete 4 MPa
tension, glass 70 MPa…) — crush verdicts that were MIXED now resolve.
Moved bodies log one "came to rest" so slides/rolls narrate their ending.

## Neo's 3D rigs (`frontend/src/lab/planeWorld.ts`)

Bodies render their substance (PBR metalness: steel/gold/copper shine; glass,
ice, diamond transmit; crates carry edge lines; molten/burning glow).
Every staged run also gets: a pulsing ground ring + floating name label, and
rig props — heat/frost chamber with light, spark gap with flickering bolt,
laser bench with beam, green acid vats as real fluid pools.
The player collides with every staged body and tank wall (water slows you);
molten bodies visibly slump into spreading puddles, burning bodies char black.

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
- 86 automated checks (`npm test`) pin: 9.80665, human terminal ≈54 m/s,
  30 m/s @45° → 91.7 m, steel↔glass mutual abrasion, corundum scratches quartz,
  oak floats / lead sinks, 3.43 km sound = 10 s, ice slides / rubber grips at 20°,
  dry sand avalanches past 35°, TNT tier, glass shatters from 50 m, oak survives 3 m.
