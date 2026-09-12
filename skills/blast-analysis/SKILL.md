# Skill: blast-analysis

Use for explosions, "how big a blast", demolition timing, "would you hear it".

## Procedure
1. `explosives` for the compound's detonation velocity + tier (or `explosive-class`
   for a raw m/s number).
2. Rule of tiers: <1000 deflagration (pushes), <5000 wide rolling blast,
   <8000 TNT-balanced, above vaporizes close objects (C-4/RDX/PETN).
3. `sound-delay` for the distance: flash first, sound at 343 m/s. Any scene where
   a 2 km blast is heard instantly is NOT REAL (5.8 s delay).
4. Combine: tier for damage + delay for timing = full cinematic verdict.

## Output
Tier + what it does to structures + hear-delay at the stated distance.
