# SUPERVISOR INBOX — read this when your current task is DONE

You are one of two workers on C:\NeoGenesis. Supervisor has queued your next polish task.
Pick the section matching your last job. Follow NEOGENESIS_RULES.md first. Small honest diffs only.

## If you just did 3D GEOMETRY (24 model classes)

Your geometry must be procedural THREE.BufferGeometry only. NO internet URLs, NO GLTF downloads,
NO new npm deps (browser-local law). dragon/ufo/kraken are INERT test masses — visual mesh may
differ, physics collision stays AABB box/sphere per engine/src/models.ts spawnModel + SCIENTIFIC_ASSUMPTIONS.md.
No walk/talk/animation-as-creature (ONE HUMAN law).

Next prompt (copy-run):
```
Read NEOGENESIS_RULES.md, ARCHITECTURE.md, SCIENTIFIC_ASSUMPTIONS.md first.
Verify planeWorld.ts uses class-specific procedural geometry for all 24 classes in engine/src/models.ts:14,
collision unchanged, zero network imports, zero Math.random in engine paths.
Run: npm test -w engine + npm run typecheck + npm run build -w frontend. Fix at root, report per GAMEPLAY.md FINDING format.
```
Then do material-truth pass: 20 registry materials in MATERIAL_VISUAL must match engine/src/materials.ts,
melt/burn/crush glow correct, glass/ice transmit. Verify via terminal `spawn-body <material> <size>`.

## If you just did PHYSICS / EXPLORATION / ENGINE

Next prompt (copy-run):
```
Run GAMEPLAY.md Section B sweep: all X Experience Lab presets + `throw a copper sphere from 100m in the water`,
`melt a lead cube in lava`, `volcano erupting with huge box`. Staged bodies must match verdict lines.
File findings, fix at root in engine/src/experience.ts / tools.ts, add check to engine/test/run-tests.mts,
never weaken tolerance. Then: npm test -w engine (234 green) + npm run typecheck + frontend build.
```
Then do feel+perf: GAMEPLAY.md A,F,E — colliders, push 50kg vs 500kg, jump ≤1m, G-key demo 5min no errors,
body budget 500, NaN freeze, rest zero-velocity, spin=v/r. Fix in player.ts/world.ts, no per-frame allocs.

## Both: docs-truth sync before finishing
If you changed physics/counts update SCIENTIFIC_ASSUMPTIONS.md, AGENTS.md, engine/README.md,
docs/EXPERIENCE.md (19,200,000). Delete any *.proof.mts temp files.

Supervisor poll: git clean + mtimes stable + typecheck green = DONE.
