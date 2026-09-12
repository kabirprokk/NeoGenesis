# Skill: material-showdown

Use when the user asks "which is stronger/lighter/tougher", "X vs Y", or wants a
ranked table of materials for a purpose (armor, tools, building, floating).

## Procedure
1. `material-list`, then `material-get` for each contender.
2. Compare the RIGHT property for the job, never vibes:
   - armor/structure → `ultimateMpa` / `yieldMpa`
   - tools/mining → `mohs` ladder (`mohs-ladder`)
   - floating → `density` vs fluid (`buoyancy`)
   - heat shield → `meltC`, `ignitionC`, `thermalWmK` (relative conduction only)
   - grip/slide → `muS`/`muK` or `friction-pairs`
3. Settle ties by simulation: `scenario` drop-test at equal heights.

## Output
Ranked table with the deciding numbers + one-line reason per rank.
