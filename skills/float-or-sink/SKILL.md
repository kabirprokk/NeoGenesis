# Skill: float-or-sink

Use for "does X float", boats, swimming, "ocean of lava/honey" questions.

## Procedure
1. `fluid-get` for the fluid (viscosity always; density only where known).
2. `buoyancy` tool: body density vs fluid density.
3. If density is unknown (oils, lava, ketchup): verdict is MIXED by policy —
   report viscosity drag only, name the missing datum, never invent a density.
4. For water/seawater/mercury: confirm by `scenario` drop into a 4 s run and read
   rest height.

## Output
Floats/sinks/UNKNOWN + the two densities (or the missing one) + what the sim did.
