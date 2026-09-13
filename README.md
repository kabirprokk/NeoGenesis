# NEOGENESIS — ONE HUMAN. ONE EARTH. NO CIVILIZATION.

Serious Earth-scale browser game + planetary simulation. The player is the only human on a
nature-reclaimed, prehistoric-inspired Earth built on real geography.

- `SCIENTIFIC_ASSUMPTIONS.md` — honest science/gameplay boundary (read first).
- `ARCHITECTURE.md` — system map, streaming, LOD, data flow.
- `frontend/` — React + TypeScript + Vite + Three.js (WebGPU-ready) client. Phase 1 playable now.
- `shared/` — `WorldEraConfig`, geo math (WGS84/ECEF/ENU), solar/lunar, climate, ecology types.
- `engine/` — dependency-free reality engine (physics + materials + 12,000-model registry + verdicts).
- `docs/` — development order, controls, API.
- Persistence is 100% browser-local (localStorage). No server, no database, no Docker.

## Quick start

```powershell
# Frontend only — no Docker, no backend, no database
cd frontend; npm install; npm run dev
# Open http://localhost:5173
```

Saves and journal persist in the browser via localStorage.

## The rules
1. **ONE HUMAN.** No human NPCs, cities, roads, infrastructure. Ever (until a story expansion).
2. **Earth-scale, streamed.** Never load the whole planet. Quadtree LOD + floating origin.
3. **No quest spam.** The world is the content. Field Journal records what *you* discover.
4. **Emptiness is the point.** Silence, wind, distant calls — not music loops.

## Controls (Phase 1)
WASD move · Shift run · C crouch · Space jump · F fire-light (campfire stub) · J journal ·
M map · H toggle HUD · drag look / click-lock pointer.
Neo bar (top): type an experiment (“throw a copper sphere from 100m in the water”) —
Neo builds it live in front of you and renders the verdict · X experience lab · ` terminal.

## Development order
Phase 1 (done): globe + coordinates + sun/moon/time + atmosphere + player →
Phase 2: terrain streaming/LOD/floating origin → Phase 3: biomes/vegetation/water/weather →
Phase 4: wildlife/ecology → Phase 5: survival/fire/exploration → Phase 6: journal/discovery/geology.
See `docs/DEVELOPMENT_ORDER.md`.
