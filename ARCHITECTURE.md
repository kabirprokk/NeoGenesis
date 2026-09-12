# ARCHITECTURE — NeoGenesis

## Monorepo
```
C:\NeoGenesis\
  frontend/  React+TS+Vite+Three.js   (renders, simulates local layer, HUD, journal UI)
  shared/    pure-TS math + types     (no DOM, no Node — importable everywhere)
  backend/   Fastify+TS, REST+WS      (saves, discoveries, journal, world-state; Redis cache)
  db/        Postgres 16 + PostGIS    (players, saves, discoveries, journal, species)
  docs/      order, controls, API
```

## Coordinate pipeline (real planet, no jitter)
WGS84 lat/lon/alt → ECEF (double, backend/shared) → local ENU around floating origin →
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
- GLOBAL: statistical per-biome population means, ticked rarely, cached in Redis.
Frontend ticks LOCAL; backend ticks REGIONAL/GLOBAL and pushes deltas over WS.

## Rendering
Three.js globe (custom atmosphere shader: Rayleigh+Mie-inspired) → terrain quadtree tiles
(heightfield workers) → instanced vegetation → water plane → volumetric-ish clouds (billboard
noise, budget-capped) → PBR sun + HDR tonemap + shadows near-field only + distance fog/AO.
WebGPU path: renderer abstraction (`frontend/src/three/renderer.ts`) — WebGL2 today,
WebGPU when available.

## Backend design (multiplayer-capable, multiplayer-forbidden)
Tables keyed by `playerId`; API never lists other players; WS rooms namespaced
`player:{id}` so a future expansion can add presence without schema rewrites.
ONE_HUMAN rule enforced: `POST /api/npc` does not exist; species seeds contain no hominins.

## Budgets (60 FPS target)
Web Workers for terrain/biome; GPU instancing; object pooling; texture streaming;
memory budget 512 MB + tile LRU; network budget: tile ≤ 128 KB, eco deltas ≤ 10 KB/s.
