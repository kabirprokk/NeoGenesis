# Development order + status (lab roadmap — no decoration phases)

- [x] **Phase 1** — plane world on the reality engine, Sun/Moon/stars,
      atmosphere shader, first-person player, solid bodies, minimal HUD,
      Neo bar + Experience Lab + terminal (one run flow), journal in localStorage.
- [ ] **Phase 2** — more verbs, more codex tables, tighter verdicts; kill every
      remaining MIXED that data can resolve.
- [ ] **Phase 3** — measurement tools: on-screen protractor/scale/stopwatch,
      trace graphs for every run.
- [ ] **Phase 4** — experiment sharing + reproducibility: export/import a run
      (sentence + seed + verdict) as a file anyone can replay.

Each phase keeps 60 FPS budgets: fixed-step sim, per-body mesh pooling, fluids rebuilt
only on change, no per-frame allocations in the hot loop.
