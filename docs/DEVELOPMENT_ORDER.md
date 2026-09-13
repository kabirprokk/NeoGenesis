# Development order + status

- [x] **Phase 1** — plane world on the reality engine, PlanetTime, Sun/Moon/stars,
      atmosphere shader, first-person player, minimal HUD, ambient audio stub.
- [ ] **Phase 2** — terrain detail (procedural heightfield next; no tile streaming).
- [ ] **Phase 3** — biomes/vegetation/water/weather/climate (weather + climate live; GPU instancing next).
- [ ] **Phase 4** — wildlife: LOCAL agents + REGIONAL/GLOBAL cohorts, food web (species defs + cohort math live in `shared`).
- [ ] **Phase 5** — survival/shelter/fire/exploration (survival live).
- [ ] **Phase 6** — Field Journal/discovery/geology/astronomy (journal live in localStorage, discovery next).

Each phase keeps 60 FPS budgets: workers, instancing, pooling, LRU.
