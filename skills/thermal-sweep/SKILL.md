# Skill: thermal-sweep

Use for "what melts/burns at X", heat tiers, lava oceans, "is this fire real".

## Procedure
1. `material-get`: read `meltC` and `ignitionC`.
2. Verdict logic (no times claimed — no specific-heat data):
   - T ≥ meltC → liquid. REAL melting, describe the puddle, not the clock.
   - ignitionC ≤ T < meltC → burns.
   - T below both → warms only. Say so plainly.
3. Lava ocean (∼1000 °C+): sweep the cast — lead (327) and aluminium (660) are
   gone, iron (1538) floats/survives briefly, diamond (4027) shrugs.
4. Conduction comparisons via `thermalWmK` are RELATIVE only (copper handle vs
   steel handle) — never quote seconds.

## Output
Melted / burning / intact per material + threshold numbers. No stopwatch fiction.
