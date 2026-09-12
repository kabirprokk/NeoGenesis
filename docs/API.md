# API

Base: `http://localhost:3001`. All player-scoped by `playerId` (`last-human` default).
No NPC endpoints exist by design (ONE HUMAN rule).

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET/POST | `/api/saves/:playerId`, `/api/saves` | save/load player (location, vitals, inventory, era, time) |
| GET/POST | `/api/journal/:playerId`, `/api/journal` | Field Journal entries |
| POST | `/api/discoveries` | caves/peaks/fossils/rivers/valleys/territories/phenomena |
| GET | `/api/species` | species defs + food web string |
| POST | `/api/eco/tick` | regional cohort tick `{dtDays, carryingCapacity, cohorts}` |
| WS | `/ws` | per-player channel; `eco-delta` relay via Redis `player:{id}` |

Offline: backend falls back to memory; frontend falls back to localStorage. Nothing breaks.
