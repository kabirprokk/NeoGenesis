# NEOGENESIS — ONE HUMAN. ONE PLANE. REAL PHYSICS.

A browser physics laboratory for everyone and for scientists. One flat solid
plane, real gravity, real material data, a reality engine, and Neo — an
in-world AI that turns sentences into live experiments with measured verdicts.
No eras, no biomes, no creatures, no decoration. Ever.

- `SCIENTIFIC_ASSUMPTIONS.md` — honest science boundary: what is measured, what is tuned (read first).
- `ARCHITECTURE.md` — system map: engine, staging, Neo, rendering.
- `frontend/` — React + TypeScript + Vite + Three.js client. Playable now.
- `shared/` — pure-TS math: lab environment, geo math, solar/lunar.
- `engine/` — dependency-free reality engine (physics + materials + science codex + Neo + verdicts).
- `docs/` — development order, controls, API.
- Persistence is 100% browser-local (localStorage). No server, no database, no Docker.

## Quick start

```powershell
# Frontend only — no Docker, no backend, no database
cd frontend; npm install; npm run dev
# Open http://localhost:5173
```

Saves, journal, and Neo's memory persist in the browser via localStorage.

## The rules
1. **ONE HUMAN.** No NPCs. Ever.
2. **Physics is the content.** Every experiment runs on real numbers — gravity, drag,
   impact stress, melt points, conductivity, corrosion timelines — never vibes.
3. **No quest spam.** The lab is the content. The journal records what *you* observe.
4. **Honesty over spectacle.** Missing data returns MIXED with the gap named — never guessed.

## Controls
WASD move · Shift run · C crouch · Space jump · J journal · H toggle HUD ·
drag look / click-lock pointer.
Neo bar (top): type an experiment (“throw a copper sphere from 100m in the water”) —
Neo builds it live in front of you and renders the verdict · X experience lab · ` terminal.

## Development order
Phase 1 (done): plane world + sun/moon/time + atmosphere + player + Neo lab →
Phase 2: more verbs, more tables, tighter verdicts → Phase 3: measurement tools
(protractors, scales, graphs) → Phase 4: experiment sharing + reproducibility.
See `docs/DEVELOPMENT_ORDER.md`.
