# SCIENTIFIC_ASSUMPTIONS.md — NeoGenesis

> Fictionalized prehistoric Earth inspired by real paleoenvironments.
> Nothing below is claimed to reconstruct one exact geological moment.
> All invented gameplay details are approximations, clearly marked as such.

## 1. Chosen geological era (initial world preset)

**Default preset: `alternate-prehuman-earth` — "Cretaceous-inspired, gameplay-tuned".**

- Geography: **modern continents, coastlines, elevation patterns** (real Earth datasets where
  available). This is deliberately anachronistic: Late Cretaceous continents were arranged
  differently. We keep modern geography for recognizability and dataset reuse, and document
  it as an artistic simplification (see §6).
- Climate/atmosphere: **Late Cretaceous-inspired greenhouse** (warmer global mean than
  preindustrial, no polar ice sheets, elevated CO₂), tuned for playability.
- Vegetation: **angiosperm-dominated lowlands + gymnosperm/fern understory**, no grasses
  as dominant biome (grasses radiated later). Gameplay stand-in: grass-like ground cover
  rendered where a savanna/steppe functional niche is needed, labeled as approximation.
- Fauna: **non-avian dinosaurs + pterosaurs + early mammals + Cretaceous marine/freshwater
  fauna**, curated as representative morphotypes, NOT a claim that these exact species
  coexisted at one locality/time.
- Humans: **exactly one** (the player). No hominins, no human NPCs. Hard rule enforced
  in code (`ONE_HUMAN_RULE`, see `shared/`).

Why not an exact stage (e.g. Maastrichtian 72–66 Ma)? Because exact co-occurrence,
continental positions, and local paleoclimate at every coordinate are underdetermined.
A single exact claim would be false precision. The `alternate-prehuman-earth` label
is honest: inspired by, not reconstructed from.

### Future presets (`WorldEraConfig`, modular)
| preset id | inspiration | geography | ice | megafauna |
|---|---|---|---|---|
| `alternate-prehuman-earth` (default) | Late Cretaceous greenhouse | modern (simplification) | none | dinosaurs |
| `jurassic-inspired` | Morrison-like floodplains | modern (simplification) | none | sauropods/theropods |
| `cretaceous-inspired` | Hell Creek-like | modern (simplification) | none | tyrannosaurs/hadrosaurs |
| `ice-age-inspired` | Late Pleistocene (~20 ka) | modern + ice sheets + lower sea level (−120 m curve) | Laurentide/Fennoscandian | mammoths/sabertooths |
| `ancient-earth` | generic deep-time | procedural | none | procedural archosaurs |

Switching presets must never introduce human NPCs/civilization.

## 2. Atmospheric assumptions
- Default: N₂ ~78%, O₂ ~21%, Ar ~1%, CO₂ ~1000 ppm (gameplay; proxy for greenhouse forcing,
  not a measured Cretaceous value — proxies range ~400–2000+ ppm depending on study).
- Mean surface pressure ~1013 hPa scaled by altitude (barometric formula).
- Rendering uses physically *inspired* Rayleigh + Mie scattering with artist-tuned
  coefficients, not a full radiative-transfer solve.
- Weather (wind/rain/storms) is a **spatially coherent cellular system** advected over the
  globe, seeded deterministically — plausible dynamics, not a GCM.

## 3. Climate assumptions
- Long-term climate = function(latitude, altitude, ocean proximity, season, atmospheric
  parameters, terrain) → temperature / precipitation / humidity / suitability.
- Lapse rate −6.5 °C/km (moist-gameplay average); polar amplification flattened because
  default preset has no ice sheets.
- Ocean moderation via distance-to-coast field; orographic lift via elevation gradient.
- Seasons from real obliquity (23.44°) + eccentricity approximation; precession fixed
  (documented simplification).
- Climate ≠ weather: climate gives suitability envelopes; weather gives instantaneous state.

## 4. Animal assumptions
- Species are **functional morphotypes** (e.g. "hadrosaur-like herd herbivore") with
  habitat / T-range / diet / water / territory / movement / predator-prey / sleep /
  reproduction / migration / fear parameters. Stats are gameplay-plausible, not
  species-level paleobiology claims.
- No feather/color claims presented as fact — procedural variation labeled as artistic.
- Behavior realism target: "sometimes observe without being attacked" — aggression is
  state-dependent (hunger, territory, defense of young), not aggro-radius arcade logic.
- Population dynamics: hierarchical — LOCAL (individual agents, <~1 km), REGIONAL
  (cohort ODEs), GLOBAL (statistical carrying-capacity models). Never simulate every
  organism planet-wide.

## 5. Vegetation assumptions
- Biomes from Whittaker-style T/P envelopes remapped for greenhouse (no tundra/ice by
  default; tundra appears only in `ice-age-inspired` or at extreme altitude).
- Pre-Cretaceous presets exclude flowering dominance; default preset assumes angiosperm
  spread (documented; exact timing debated).
- No "random green forest": placement uses latitude × elevation × rainfall × temperature ×
  soil proxy × biome × season. Soil is a procedural proxy (drainage + fertility noise),
  not a soil survey.
- Fire spread uses cellular/grid moisture/fuel/wind model — plausible, not a combustion solve.

## 6. Geographic assumptions
- Real WGS84 planet (a=6378137 m, f=1/298.257223563). Coastlines come from a real
  ocean mask raster and terrain height from a real relief raster (vendored NASA Blue
  Marble-family imagery, pixel-calibrated — see `docs/ASSETS.md`). Relief is
  range-scaled (Everest ≈ 5200 m in-game), not a survey DEM: the coastline layer is
  the accurate one.
- **Deliberate anachronism:** modern continental positions used under a Cretaceous-inspired
  biosphere. Documented in-game in the Field Journal ("cartographic simplification").
- Sea level fixed per preset (default 0 m modern datum; ice-age preset applies eustatic curve).
- Rivers/lakes: dataset polylines where available, procedural runoff-carved otherwise;
  waterfalls where slope + discharge thresholds met (gameplay-simplified).

## 7. Scientific uncertainties (honest list)
1. Exact atmospheric CO₂/O₂ for any single Cretaceous moment — proxy spread is large.
2. Dinosaur social structure, coloration, vocalization — largely unknown; game choices are art.
3. Fine-scale paleoclimate at arbitrary lat/lon — unknowable; model outputs are envelopes.
4. Plant community composition at arbitrary sites — same; biomes are functional analogues.
5. Continental positions vs. chosen biosphere — intentionally mismatched (see §6).
6. Behavior parameters (fear radius, migration triggers) — gameplay-tuned, not measured.

## 8. Gameplay simplifications (load-bearing)
- Earth-scale ≠ full-detail everywhere: quadtree LOD + streaming + impostors; only the
  player's neighborhood is high-fidelity.
- Ecology: Lotka-Volterra-ish cohort models regionally/globally; individuals only locally.
- Survival: hunger/thirst/temperature/stamina/health/sleep simplified to readable rates;
  no medical simulation.
- Time: real solar position math (NOAA-style), but day length fixed at 24 h (Cretaceous days
  were ~23.5 h — noted, not simulated by default; toggleable in `WorldEraConfig`).
- Moon: real phase/geometry math, simplified ephemeris (low-precision lunar theory, ±arcmin).
- Multiplayer: forbidden initially (ONE HUMAN rule); backend keeps `playerId` isolation so a
  future story expansion could revisit the rule without schema rewrites.
- Persistence: player state/discoveries/journal saved; terrain vertices never stored.

## 9. What we will never claim
- That any dinosaur mesh/behavior is "scientifically exact".
- That modern geography + Cretaceous life coexisted historically.
- That climate/weather/ecology outputs are predictions — they are internally consistent
  gameplay models with disclosed proxies.
