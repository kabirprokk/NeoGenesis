# Skill: friction-audit

Use for slipping, climbing, drifting, "can it stand on this slope", avalanches.

## Procedure
1. `friction-pairs` (named pairs) or `material-get` (muS/muK).
2. `slide-check`: slides iff tan(angle) > μs. Quote both numbers.
3. Granular piles (sand, soil, gravel, scree): use `repose-check`, NOT friction —
   anything piled past its repose band avalanches (dry sand >35° is NOT REAL).
4. Wet note: rubber on wet concrete (0.3) vs dry (1.0) — rain flips verdicts.

## Output
Slides/grips + tan(angle) vs μs, or repose verdict with the band.
