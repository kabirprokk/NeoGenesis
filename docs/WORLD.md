# WORLD — how NeoGenesis builds a believable planet (no placeholders)

Pipeline (all in `frontend/src/world/`, all seeded/deterministic per location):

```
Real elevation raster / procedural fallback
  → WorldTerrainSystem (geology.ts): continental base → mountain mask → ridged
    massifs + foothill aprons + rolling hills + plateau benches → droplet hydraulic
    erosion (gullies/valleys/sediment) + thermal weathering → river tracing with
    flow accumulation (carved channels, growing width) + trapped basins → lakes
  → TerrainMaterialSystem (terrainMaterial.ts): per-vertex grass/dirt/mud/sand/
    rock/scree/snow/seabed by slope × altitude × moisture × temperature × biome,
    macro detail texture, storm wetness (rain darkens + smooths response)
  → RiverSystem / LakeSystem / OceanSystem (hydrology.ts): flow-animated ribbons
    in carved channels, basin discs, shoreline-contour foam
  → VegetationSystem / RockSystem (vegetation.ts): moisture-clustered groves,
    canopy + trunks + shrubs + wind-swayed grass; boulders on scree, pebbles on
    shores — every instance mesh/scale/rotation/color-varied (EnvironmentAssetSystem)
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
via `ModelLibrary` slots when licensed scans are sourced (see ASSETS.md).
