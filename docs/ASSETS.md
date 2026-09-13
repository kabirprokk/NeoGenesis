# ASSETS — real Earth data + real 3D models

## Earth surface (vendored, ~1 MB total)
Fetched by `npm run fetch-assets` (`frontend/scripts/fetch-assets.mjs`) into `public/earth/`:

| file | what the game uses it for | upstream |
|---|---|---|
| `earth-day.jpg` (239 KB) | globe surface texture + planetary-map background | NASA Blue Marble via three-globe example assets (MIT © Vasco Asturiano) |
| `earth-topology.png` (369 KB) | relief proxy → terrain height, globe bumpMap | derived relief/bathymetry via three-globe (MIT) |
| `earth-water.png` (420 KB) | **ocean mask = real coastlines**; drives water rendering, climate ocean-proximity, spawn validation | via three-globe (MIT) |

Calibration (pixel probes at Pacific/Sahara/Everest/Amazon/London, 2026-09):
water mask white=ocean / black=land; relief grayscale (Everest 226, trench 0).
Elevation mapping: land `pow(topo,1.15)*6000` m, ocean `−(1500+(1−topo)*2500)` m,
beach-blended across the surf zone. **Honest limits:** the coastline mask is the
accurate layer; relief is range-scaled, not a survey DEM. Production upgrade path:
swap these three files for direct NASA Visible Earth Blue Marble + ETOPO1/GEBCO grids —
no code change needed (`EarthData` samples any equirectangular pair).

## 3D models (vendored)
`public/models/` — real rigged/animated GLBs (slot convention: Y-up, meters,
origin at feet), all with procedural fallback if absent. Note: the runtime GLB
loader (`three/models.ts`) was removed with the dead fauna code, so these files
are currently staged assets, not live-loaded:

| slot | role | source |
|---|---|---|
| `horse` | Pleistocene equid, **only** under `ice-age-inspired` preset | three.js example asset |

Deliberately EMPTY: ambient-bird slots. A previous iteration flew low-poly circling
birds around the player and broke immersion, so they were removed. Fauna arrives only
via art-directed, era-correct models through the slot convention below (Y-up, meters,
origin at feet): `trex.glb`, `hadrosaur.glb`, `raptor.glb`, `mammoth.glb`,
`pterosaur.glb`, `conifer.glb`, `palm.glb`, `fern.glb`, `rock-basalt.glb`,
`rock-granite.glb`.

Dinosaur morphotypes (hadrosaur/tyrannosaur/raptor) remain clearly-labeled procedural
stand-ins: no freely-redistributable, scientifically-rigorous dinosaur scans with stable
URLs were found. To upgrade with zero code change, drop files into `public/models/`
following the slot convention (Y-up, meters, origin at feet): `trex.glb`, `hadrosaur.glb`,
`raptor.glb`, `mammoth.glb`, `pterosaur.glb`, `conifer.glb`, `palm.glb`, `fern.glb`,
`rock-basalt.glb`, `rock-granite.glb` — picked up automatically once the slot
loader is re-added.
Recommended sources: Smithsonian Open Access (CC0, fossils/skeletons — ideal for the
fossil-discovery system), Sketchfab-licensed scans, Quaternius (CC0, stylized flora).
For commercial release, replace three.js example models with directly-licensed scans.
