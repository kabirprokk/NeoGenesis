# MODELS_NEEDED — yes, please send 3D models. This is the exact shopping list.

Drop files into `C:\NeoGenesis\frontend\public\models\`. No code changes, no config —
`ModelLibrary` picks them up on next load and auto-replaces the matching stand-ins
(fauna swaps instantly; flora/rocks apply on the next terrain refresh).

## Hard requirements (all 12 slots)
- Format: **GLB** (`.glb`, embedded textures — single file per slot, no sidecars)
- Up: **Y-up** · Units: **meters** · Origin: **at the feet**, centered on the animal/object
- PBR materials (baseColor + normal + roughness at minimum); no external URLs inside
- No human content anywhere (ONE HUMAN rule — the player is the only human)

## Fauna (auto-replaces the capsule stand-ins, scaled to the listed height)
| file | replaces | target height | notes |
|---|---|---|---|
| `trex.glb` | tyrannosaur-like predator | ~4.2 m | walk cycle preferred; state-driven speeds apply automatically |
| `hadrosaur.glb` | hadrosaur-like herd grazer | ~3.0 m | graze + walk; herd behavior already in sim |
| `triceratops.glb` | ceratopsian-like defender | ~2.6 m | defensive circle behavior already in sim |
| `raptor.glb` | raptor pack + small herbivores (scaled copies) | ~1.7 m | run cycle; nocturnal flag handled by sim |
| `pterosaur.glb` | high soarer/scavenger | ~2.4 m | soar pose + flap; circling logic already in sim |
| `mammoth.glb` | ice-age megaherbivore (ice-age preset only) | ~4.0 m | walk cycle |

Any rigged + animated GLB works — clips play automatically via `AnimationMixer`
(first clip). Static (unrigged) also works: it still replaces the capsule and follows
the behavior sim, just without limb motion.

## Flora (auto-replaces the instanced primitives 1:1, GPU-instanced as-is)
| file | replaces | size hint |
|---|---|---|
| `conifer.glb` | cold-biome canopy mesh | ~4–8 m tall, origin at trunk base |
| `palm.glb` | jungle/forest canopy mesh | ~4–8 m tall, origin at trunk base |
| `fern.glb` | (reserved — understory layer, wiring next) | ~0.5–1 m |

Keep each under ~150 KB / ~5k tris if possible — they render hundreds of times.
Per-instance color/scale/rotation variation is applied by the engine, so ONE mesh
per slot never looks repeated.

## Rocks (same instancing path)
| file | replaces |
|---|---|
| `rock-a.glb` | boulder mesh (~1–3 m, any shape) |
| `rock-b.glb` | stone mesh (~0.3–1 m) |

Boulders are solid (colliders auto-generated from instance scale).

## Where to get them (licensed, no gray-area rips)
- Smithsonian Open Access (CC0) — fossils/skeletons; ideal reference, some 3D
- Sketchfab store / sketchfab.com (check license per model; prefer CC0/CC-BY)
- Quaternius (CC0, stylized flora/rocks — good enough for vegetation slots)
- Any commercial pack you own (e.g. BigMediumSmall, NatureManufacture) — export GLB

## What NOT to send
Low-poly meme animals, circling-bird-style ambient packs, anything with baked-in
ground planes or human figures, FBX/OBJ (convert to GLB first), 50 MB scans
(decimate + compress with `gltfpack`/`glTF-Transform` first).
