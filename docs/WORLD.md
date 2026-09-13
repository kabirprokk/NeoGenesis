# WORLD — how NeoGenesis builds a believable planet (no placeholders)

Present state: the playable game is a plain physics plane (`frontend/src/lab/planeWorld.ts`)
on the reality engine — real gravity, real material bodies, real sky/sun/moon/climate.
The terrain-streaming pipeline below was removed as dead code (nothing in the game
imported it); this section is kept as the design for re-adding terrain later.

Removed pipeline (design reference, not live code):

```
Real elevation raster / procedural fallback
  → continental base → mountain mask → ridged massifs + foothills + rolling
    hills + plateau benches → droplet hydraulic erosion + thermal weathering
    → river tracing with flow accumulation + trapped basins → lakes
  → per-vertex grass/dirt/mud/sand/rock/scree/snow/seabed by slope × altitude
    × moisture × temperature × biome, storm wetness
  → flow-animated river ribbons in carved channels, basin discs, shoreline foam
  → moisture-clustered groves, canopy + trunks + shrubs + wind-swayed grass;
    boulders on scree, pebbles on shores
  → EnvironmentalAudioSystem (audio/ambience.ts): surf near water, insects in night
    forests, thin air at altitude, storm wind body
```

Frames: one spawn-anchored world frame (ENU meters of spawn) shared by feet, terrain,
water, vegetation, rocks, rivers, and fauna — walking can never detach you from the
world. A 40 km far-field ring carries real landforms to the horizon (fog + atmosphere
do the rest); the miniature space-globe stays hidden in surface mode. Trees, boulders,
and animals are solid (circle-collider push-out), uphill costs speed, the camera can't
clip underground, and the shadow frustum follows you. Scatter seeds quantize to location,
so rebuilds are pop-free. Rebuilds run on real movement (>25 m) or 8 s staleness;
GPU resources are disposed every cycle (no heap bleed).

Honest limits: relief raster is range-scaled (coastline mask is the accurate layer);
upgrade path is ETOPO1/GEBCO with no code change. Dinosaur/AAA flora models arrive
via model slots when licensed scans are sourced (see ASSETS.md).
