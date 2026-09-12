# Development order + status

- [x] **Phase 1** — globe, WGS84/ECEF/ENU, floating origin, PlanetTime, Sun/Moon/stars,
      atmosphere shader, first-person player, minimal HUD, ambient audio stub.
- [ ] **Phase 2** — real terrain datasets + `WorldStreamer` quadtree/LOD/workers (stub + procedural heightfield live).
- [ ] **Phase 3** — biomes/vegetation/water/weather/climate (interfaces + CPU models live; GPU instancing next).
- [ ] **Phase 4** — wildlife: LOCAL agents + REGIONAL/GLOBAL cohorts, food web (architecture + species DB live).
- [ ] **Phase 5** — survival/shelter/fire/exploration (survival + fire-cell model live).
- [ ] **Phase 6** — Field Journal/discovery/geology/astronomy (journal + discovery live, geology next).

Each phase keeps 60 FPS budgets: workers, instancing, pooling, LRU.
