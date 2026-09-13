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

## Coordinate pipeline (real planet, no jitter)
WGS84 lat/lon/alt → ECEF (double, shared) → local ENU around floating origin →
Three.js scene (float32, origin rebased when player moves > 5 km). `shared/src/geo.ts`
implements `llaToEcef`, `ecefToEnu`, `enuToEcef`, `ecefToLla`, `FloatingOrigin`.
Player may travel thousands of km without precision degradation.

## Frame data flow
```
WorldEraConfig → Climate → Biome → Vegetation/Water/Weather → Ecology(LOD) → Player/Survival → HUD/Journal
        ↑ PlanetTime (real solar math) → Sun/Moon/Atmosphere uniforms
WorldStreamer: player region → required tiles (quadtree) → fetch prioritized → evict distant → LOD swap
```

## Simulation LOD (distance-based, §7 of spec)
- LOCAL (<~1 km): individual agents — movement, perception, hunger/thirst, combat/flee.
- REGIONAL (<~100 km): cohort ODEs (Lotka-Volterra-ish + water/vegetation carrying capacity).
- GLOBAL: statistical per-biome population means, ticked rarely, cached in memory.
Frontend ticks LOCAL; REGIONAL/GLOBAL cohorts tick in `shared/src/ecology.ts`.

## Rendering
Three.js globe (custom atmosphere shader: Rayleigh+Mie-inspired) → terrain quadtree tiles
(heightfield workers) → instanced vegetation → water plane → volumetric-ish clouds (billboard
noise, budget-capped) → PBR sun + HDR tonemap + shadows near-field only + distance fog/AO.
WebGPU path: renderer abstraction (`frontend/src/three/renderer.ts`) — WebGL2 today,
WebGPU when available.

## Persistence (browser-local, multiplayer-forbidden)
Saves + journal live in localStorage, keyed by `playerId` (`frontend/src/api/client.ts`).
ONE_HUMAN rule enforced: no NPC endpoints exist anywhere; species seeds contain no hominins.

## Budgets (60 FPS target)
Web Workers for terrain/biome; GPU instancing; object pooling; texture streaming;
memory budget 512 MB + tile LRU; network budget: tile ≤ 128 KB, eco deltas ≤ 10 KB/s.
