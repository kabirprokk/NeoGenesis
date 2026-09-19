# AGENTS.md — how an AI agent fulfills NeoGenesis user requests

> New here? Read `NEOGENESIS_RULES.md` first — it holds the laws that never
> change. This file is the instrument manual.

You (the agent) have three instruments. Use them in this order.

## 1. Tools — do things (`C:\NeoGenesis\engine\src\tools.ts`, 36 tools)
List: `cd C:\NeoGenesis\engine; npm run experience -- --tools`.
Single call: `npm run experience -- --tool <name> '<json-args>'`.
Prefer `scenario` (JSON) over `verdict` (natural language) for precision work —
scenarios control bodies, gravity, air, ambient, duration, and checks.

## 2. Skills — follow procedures (`C:\NeoGenesis\skills/*/SKILL.md`)
Don't improvise a method the skill already standardizes. Map the request:
fall/crash → `drop-test` · X-vs-Y → `material-showdown` · other planets →
`planet-survey` · float/swim → `float-or-sink` · cut/mine → `scratch-ladder` ·
explosions → `blast-analysis` · slip/climb → `friction-audit` · melt/burn →
`thermal-sweep`. Output in the skill's format.

## 3. The game — show it (`C:\NeoGenesis\frontend`)
The plane world runs the same engine. To put a result in front of the user:
- `sim-spawn` equivalent in-game is the terminal (`~` key): `spawn-body <material> <size>`.
- Verdicts render in the Experience Lab (X key) via the same `experience()` call.
- Never claim the game shows something the engine didn't compute.

## Physics Engine Architecture (v2)
The engine has a custom `EngineWorld` simulation (120 Hz, CCD-lite) plus optional
`cannon-es` integration for constraints/joints/raycasting.
- **Collision Groups**: `collision-groups.ts` — bitmask-based filtering (GROUND, STRUCTURES, DYNAMIC_SOLID, PROJECTILE, FLUID, PLAYER, ENEMY, etc.)
- **Tunable Parameters**: `physics-tunable.ts` — documented `PhysicsConfig` with `WorldConfig`, `CollisionTuning`, `DragTuning`, `SleepTuning`, environment presets
- **Broad Phase**: `spatial-grid.ts` — `SpatialGrid` + `BroadPhaseDetector` reduces O(n²) to O(n·k)
- **Cannon Bridge**: `cannon-integration.ts` — `CannonWorld` class for constraints, raycasting, impulse
- **Cloud Physics**: `cloud-physics.ts` — real-world cloud simulation (9 types: cirrus, cirrocumulus, altocumulus, altostratus, stratus, stratocumulus, cumulus, cumulonimbus, nimbostratus, fog) with wind-driven advection, jet stream, turbulence, precipitation, formation/dissipation, altitude-coupled atmosphere, ice physics
- **Cloud Rendering**: `frontend/src/three/clouds.ts` + `enhanced-clouds.ts` — physics-driven cloud meshes with type-specific textures, night dimming, rain particle effects
- **Tests**: `test/physics-enhanced.test.ts` (29 tests) + `test/cloud-physics.test.ts` (24 tests) — 53 total tests covering all physics systems
- Run: `npm test` and `npm run typecheck`

## Laws
1. REAL only when numbers clear thresholds. MIXED + named gap > guessed REAL.
2. Only `restitution` is tuned (labeled); everything else is codex table data.
3. 19,200,000 models via `model-get`/`model-search`/`model-spawn` — deterministic by index.
4. ONE HUMAN rule stands: bodies and tools are objects, never NPCs.
5. `npm test` in `engine/` must stay green (29 checks). Add a check when you add physics.

## 4. Playtesting like a player (GAMEPLAY.md + demo mode)
Unit tests catch code errors, never feel. Before calling game feel done:
play it — headlessly via `GAMEPLAY.md`'s sweep, or press G in-game and watch
`aiPlayer.ts` drive the body (keys + camera + Ask/Run only, never commands).
File findings in GAMEPLAY.md's format, fix at the root, re-verify all three:
engine suite + `npm run typecheck` + frontend build.
