// PlaneWorld — the visual side of the plain plane world. One flat solid plane
// (y=0, 4 km across, follows the player) + one mesh per engine body, synced
// every frame. Bodies show their state: crushed tint when broken, glow when
// molten/burning. No terrain, no trees, no animals — physics is the content.
import * as THREE from "three";
import { MATERIALS, type EngineWorld, type FluidBox } from "../../../engine/src/index.js";

function gridTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8f947e"; g.fillRect(0, 0, 256, 256);
  // faint noise so the plane isn't a flat gamey fill
  for (let i = 0; i < 900; i++) {
    const v = 130 + Math.floor(Math.random() * 30);
    g.fillStyle = `rgb(${v},${v + 4},${v - 12})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = "rgba(60,64,50,0.55)"; g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254); // 10 m grid lines
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(400, 400);
  return t;
}

export class PlaneWorld {
  group = new THREE.Group();
  private ground: THREE.Mesh;
  private meshes = new Map<string, THREE.Object3D>();
  private fluidGroup = new THREE.Group();
  private fluidKey = "";

  constructor() {
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 1, metalness: 0 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    this.group.add(this.fluidGroup);
  }

  follow(x: number, z: number): void {
    this.ground.position.set(Math.round(x / 10) * 10, 0, Math.round(z / 10) * 10);
  }

  sync(world: EngineWorld): void {
    const seen = new Set<string>();
    for (const b of world.bodies) {
      seen.add(b.id);
      let m = this.meshes.get(b.id);
      if (!m) {
        const color = MATERIALS[b.material.id]?.color ?? 0x888888;
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
        if (b.material.id === "glass" || b.material.id === "ice") { mat.transparent = true; mat.opacity = 0.4; }
        m = b.shape === "sphere"
          ? new THREE.Mesh(new THREE.SphereGeometry(b.radiusM, 24, 18), mat)
          : new THREE.Mesh(new THREE.BoxGeometry(
              (b.halfM ? b.halfM.x : b.radiusM) * 2,
              (b.halfM ? b.halfM.y : b.radiusM) * 2,
              (b.halfM ? b.halfM.z : b.radiusM) * 2), mat);
        m.castShadow = true;
        this.group.add(m);
        this.meshes.set(b.id, m);
      }
      m.position.set(b.pos.x, b.pos.y, b.pos.z);
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const u = (m as THREE.Object3D & { userData: Record<string, unknown> }).userData;
      if (b.broken && !u.crushed) { u.crushed = true; m.scale.y *= 0.45; mat.color.multiplyScalar(0.55); }
      if (b.molten) mat.emissive.setHex(0xff5a00).multiplyScalar(0.7);
      else if (b.burning) mat.emissive.setHex(0xff2200).multiplyScalar(0.5);
    }
    for (const [id, m] of this.meshes) {
      if (!seen.has(id)) { this.group.remove(m); this.meshes.delete(id); }
    }
  }

  private static fluidColor(name: string): { color: number; emissive?: number } {
    const n = name.toLowerCase();
    if (n.includes("lava")) return { color: 0xff5a00, emissive: 0xff4400 };
    if (n.includes("honey")) return { color: 0xc98a1a };
    if (n.includes("mercury")) return { color: 0xb8bcc2 };
    if (n.includes("oil") || n.includes("ketchup")) return { color: 0x4a2c10 };
    return { color: 0x2a6a9a }; // water family
  }

  /** Visible fluid volumes — rebuilt only when the set changes (static thereafter). */
  syncFluids(fluids: FluidBox[]): void {
    const key = fluids.map((f) => `${f.name}:${f.min.x},${f.min.y},${f.min.z}:${f.max.x},${f.max.y},${f.max.z}`).join("|");
    if (key === this.fluidKey) return;
    this.fluidKey = key;
    this.fluidGroup.clear();
    for (const f of fluids) {
      const w = f.max.x - f.min.x, h = f.max.y - f.min.y, d = f.max.z - f.min.z;
      if (w <= 0 || h <= 0 || d <= 0) continue;
      const { color, emissive } = PlaneWorld.fluidColor(f.name);
      const vol = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.38, roughness: 0.1, depthWrite: false }));
      vol.position.set((f.min.x + f.max.x) / 2, (f.min.y + f.max.y) / 2, (f.min.z + f.max.z) / 2);
      vol.renderOrder = 1;
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.8, roughness: 0.05,
          emissive: emissive ?? 0x000000, emissiveIntensity: emissive ? 0.8 : 0 }));
      surf.rotation.x = -Math.PI / 2;
      surf.position.set((f.min.x + f.max.x) / 2, f.max.y + 0.01, (f.min.z + f.max.z) / 2);
      surf.renderOrder = 2;
      this.fluidGroup.add(vol, surf);
    }
  }
}
