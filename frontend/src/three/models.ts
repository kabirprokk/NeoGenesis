// Real GLB model library with graceful fallback to procedural stand-ins.
// Vendored by `npm run fetch-assets` into /models/ (see docs/ASSETS.md for licenses).
// Drop-in convention (see docs/MODELS_NEEDED.md): /models/<slot>.glb, Y-up, meters,
// origin at feet. Missing files are silently skipped — the game never breaks on assets.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface ModelSlot { id: string; url: string; scale: number; animated: boolean }
export const MODEL_SLOTS: ModelSlot[] = [
  // Pleistocene equid — enabled only under the ice-age-inspired era preset.
  { id: "horse", url: "/models/horse.glb", scale: 1.0, animated: true },
  // Fauna slots: tyrannosaur, hadrosaur, ceratopsian, dromaeosaur, pterosaur, mammoth.
  { id: "trex", url: "/models/trex.glb", scale: 1.0, animated: true },
  { id: "hadrosaur", url: "/models/hadrosaur.glb", scale: 1.0, animated: true },
  { id: "triceratops", url: "/models/triceratops.glb", scale: 1.0, animated: true },
  { id: "raptor", url: "/models/raptor.glb", scale: 1.0, animated: true },
  { id: "pterosaur", url: "/models/pterosaur.glb", scale: 1.0, animated: true },
  { id: "mammoth", url: "/models/mammoth.glb", scale: 1.0, animated: true },
  // Flora slots: conifer, palm/broadleaf, ferns. Rock slots: two boulder meshes.
  { id: "conifer", url: "/models/conifer.glb", scale: 1.0, animated: false },
  { id: "palm", url: "/models/palm.glb", scale: 1.0, animated: false },
  { id: "fern", url: "/models/fern.glb", scale: 1.0, animated: false },
  { id: "rock-a", url: "/models/rock-a.glb", scale: 1.0, animated: false },
  { id: "rock-b", url: "/models/rock-b.glb", scale: 1.0, animated: false },
];

export class ModelLibrary {
  private loader = new GLTFLoader();
  private cache = new Map<string, THREE.Group>();
  mixers: THREE.AnimationMixer[] = [];

  async loadAll(onOne?: (id: string, ok: boolean) => void): Promise<void> {
    await Promise.all(MODEL_SLOTS.map(async (s) => {
      try {
        const gltf = await this.loader.loadAsync(s.url);
        const root = gltf.scene;
        root.scale.setScalar(s.scale);
        this.cache.set(s.id, root);
        if (s.animated && gltf.animations.length) {
          const mixer = new THREE.AnimationMixer(root);
          mixer.clipAction(gltf.animations[0]).play();
          this.mixers.push(mixer);
        }
        onOne?.(s.id, true);
      } catch {
        onOne?.(s.id, false); // file absent → caller keeps procedural stand-in
      }
    }));
  }
  has(id: string): boolean { return this.cache.has(id); }
  // First mesh geometry of a slot — for GPU-instanced scatter (flora/rocks).
  // Shared reference (never mutated); undefined when the file is absent.
  geometryOf(id: string): THREE.BufferGeometry | undefined {
    let out: THREE.BufferGeometry | undefined;
    this.cache.get(id)?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!out && m.isMesh) out = m.geometry;
    });
    return out;
  }
  spawn(id: string): THREE.Object3D | null {
    const m = this.cache.get(id);
    if (!m) return null;
    const c = m.clone(true);
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
    return c;
  }
  tick(dt: number) { for (const m of this.mixers) m.update(dt); }
}
