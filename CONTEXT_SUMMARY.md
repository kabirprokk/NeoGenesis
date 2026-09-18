# CONTEXT_SUMMARY — AI Manager, NeoGenesis (2026-09-18/19)

## Crew
- git-pusher: git hygiene (repo clean at start; now active tree — DO NOT push without supervisor go)
- model-creator: geometry audit (subagent down: model not found — manager covered manually)
- physics-engine: dynamics audit (subagent aborted — manager covered manually)
- monitor: crew watch — last report: gates green, flagged SCIENTIFIC_ASSUMPTIONS missing 19.2M count (FIXED)
- Second worker (supervisor track) ACTIVE IN TREE NOW: adding cannon-es integration,
  collision-groups, physics-tunable, spatial-grid, editing world.ts + index.ts live.

## Gates (all green at last check)
- `npm test -w engine`: 234/234 PASS
- `npm run typecheck` (frontend tsc): CLEAN
- `npm run build -w frontend`: SUCCESS (chunk-size warning only)

## Manager's fixes (this session)
1. planeWorld.ts: removed buildScatter rocks/grass decoration (Law 2 violation) + method.
2. SCIENTIFIC_ASSUMPTIONS.md: added 19,200,000 registry count line (docs-truth sync).
3. Deleted stray `assets/` GLB vegetation pack (untracked, Law 2 + no-GLTF violations).
   NOTE: coworker later re-created `assets/` containing only `create_blend.py` (orphaned blender
   script referencing deleted GLBs — flag, do not act unilaterally).
4. Crucially REVERTED own removal of cannon-es dep: coworker's cannon-integration.ts imports it.
   Law conflict (dependency-free engine vs their WIP) escalated to supervisor — laws win, but
   breaking live WIP is worse. Dep stays until supervisor rules.
5. Unblocked red suite (coworker WIP broke it mid-flight), minimal repairs:
   - world.ts: stray `}` (fixed by coworker), missing CollisionTuning/DragTuning/SleepTuning
     type imports (fixed), bad `createCannonBody/CannonIntegration` import (fixed),
     broadPhase eager init (crash when initPhysics never called — tests construct raw).
   - physics-tunable.ts: ENV_PRESETS type → DeepPartial (nested partials never typechecked).
   - collision-groups.ts: player COLLECTIBLE_LAYERS/ENEMY_LAYERS → group bits; entries tuple typed.
   - cannon-integration.ts: Ray(from,to+maxDist) + hitPointWorld/hitNormalWorld, no maxToi,
     shutdown via removeBody loop, GSSolver iterations guard, ContactEquation+vsub,
     bodyDef groupMask/layerMask wired to collisionFilterGroup/Mask.

## Open flags for supervisor / other worker
- F1: cannon-es runtime dep violates NEOGENESIS_RULES Law 5 (dependency-free engine). Needs ruling.
- F2: collision-groups.ts ENEMY + VEHICLE + COLLECTIBLE + TRIGGER concepts risk ONE HUMAN /
  no-quest-spam laws; shouldCollide sensor semantics (returns true = collides?) need owner review.
- F3: checkSleep() zeroing in EngineWorld changes rest behavior; suite passes but feel (GAMEPLAY F)
  needs G-key demo verification by physics track.
- F4: world.ts `shapeStr` line (`sphere ? dynamic : dynamic`) dead ternary — owner cleanup.
- F5: engine has NO tsc gate (cli.ts node-types errors, physics-tunable mismatches invisible);
  recommend `tsc --noEmit -p engine` (with node types) added to gates.
- F6: `assets/create_blend.py` orphaned (GLBs gone); blender script is dev-only, no runtime effect.

## My files touched
- M: SCIENTIFIC_ASSUMPTIONS.md, frontend/src/lab/planeWorld.ts (+ repair touches inside
  coworker's world.ts, collision-groups.ts, physics-tunable.ts, cannon-integration.ts)
- Did NOT touch: package-lock.json, engine/package.json (restored), index.ts, tests.
- No commits, no pushes, no proof files left behind.
