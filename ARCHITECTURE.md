# ARCHITECTURE — NeoGenesis

## Monorepo
```
C:\NeoGenesis\
  frontend/  React+TS+Vite+Three.js   (renders, simulates local layer, HUD, journal UI)
  shared/    pure-TS math + types     (no DOM, no Node — importable everywhere)
  engine/    dependency-free reality engine (physics, materials, models, experience)
  docs/      order, controls, API
```

Persistence is browser-local (localStorage via `frontend/src/api/client.ts`).
No server, no database, no Docker.

## Coordinates (plane world, present state)
Feet live in plane metres around the spawn; the ground mesh follows the player
in 10 m snaps so floating-point precision never degrades. `shared/src/geo.ts`
(WGS84/ECEF/ENU, `FloatingOrigin`) and the sky's lat/lon sun math remain as the
library for a future terrain build — the playable game doesn't stream terrain.

## Frame data flow (plane world, present state)
```
EngineWorld (120 Hz fixed step) → PlaneWorld meshes + fluids → Player/Survival → HUD/Journal
        ↑ PlanetTime (real solar math) → Sun/Moon/Atmosphere uniforms
Neo runExperiment: sentence → plan → staged rig → live sim → verdict
```

## Simulation (present state)
- EngineWorld: rigid bodies (box/sphere) + fluid volumes, 120 Hz fixed step,
  gravity, quadratic drag, buoyancy + viscosity, bounce/friction, shatter/melt/ignite.
- Cohorts/ODEs tick in `shared/src/ecology.ts` for verdicts (no live agents).
- ONE HUMAN: no NPCs anywhere; species seeds contain no hominins.

## Rendering (present state)
Three.js WebGL2: 4 km ground plane (canvas grid texture) + one PBR mesh per
engine body (material metalness/roughness, crate edges, crush/melt/burn state)
+ fluid volumes with surfaces + glass tank walls + Neo rig props (chambers,
spark gap, laser bench, marker ring + label) + atmosphere shell, sun/moon with
shadow frustum following the player, stars, distance fog. No terrain tiles,
no workers, no WebGPU path yet.

## Persistence (browser-local, multiplayer-forbidden)
Saves + journal live in localStorage, keyed by `playerId` (`frontend/src/api/client.ts`).
ONE_HUMAN rule enforced: no NPC endpoints exist anywhere; species seeds contain no hominins.

## Budgets (60 FPS target)
Fixed-step sim decoupled from frame rate; meshes pooled per body id and
removed on cleanup; fluid volumes rebuilt only when the set changes;
single reused rig light; no per-frame allocations in the hot loop.
