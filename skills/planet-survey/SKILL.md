# Skill: planet-survey

Use when the user asks "what would this be like on Mars / the Moon / Jupiter" or
wants the same experiment across worlds.

## Procedure
1. `planet-get` for each named world (note gravity, pressure, temp, hazards).
2. Run the SAME `scenario` once per world via `env` preset (or raw `gravity` /
   `ambientC` / `airDensity`). Near-vacuum worlds (Moon, Mars): set airDensity ~0.001.
3. Compare: fall time, impact velocity, range, thermal state (Venus melts lead at
   464 °C ambient — check `meltC`!), buoyancy only where fluids exist.
4. Flag hazards from the planet record (no solid surface on gas giants → any
   "landing" verdict is NOT REAL by construction).

## Output
Per-planet table: fall time, impact, verdict. Lead with the most surprising row.
