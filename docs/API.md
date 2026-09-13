# API — browser-local web storage (no server)

All player-scoped by `playerId` (`last-human` default). Implemented in
`frontend/src/api/client.ts` on top of localStorage. No NPC endpoints exist
by design (ONE HUMAN rule).

| Function | Key | Purpose |
|---|---|---|
| `loadSave(playerId)` / `storeSave(save)` | `neo-save-{playerId}` | save/load player (location, vitals, inventory, era, time) |
| `loadJournal(playerId)` / `addJournal(entry)` | `neo-journal-{playerId}` | Field Journal entries (last 100 kept) |

Ecology cohorts tick in-page via `shared/src/ecology.ts` (`tickCohorts`).
Species defs come from `shared/src/ecology.ts` (`SPECIES`, `FOOD_WEB`).
