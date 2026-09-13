# AGENTS.md — how an AI agent fulfills NeoGenesis user requests

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

## Laws
1. REAL only when numbers clear thresholds. MIXED + named gap > guessed REAL.
2. Only `restitution` is tuned (labeled); everything else is codex table data.
3. 12,000 models via `model-get`/`model-search`/`model-spawn` — deterministic by index.
4. ONE HUMAN rule stands: bodies and tools are objects, never NPCs.
5. `npm test` in `engine/` must stay green (86 checks). Add a check when you add physics.
