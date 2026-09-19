// PlaneWorld — the visual side of the plain plane world. One flat solid plane
// (y=0, 4 km across, follows the player) + one mesh per engine body, synced
// every frame. Bodies show their state AND their substance: metals shine,
// glass/ice transmit, crates carry edge lines, molten/burning bodies glow.
// Neo's rigs get props (heat chamber, spark gap, laser bench) plus a ground
// marker + label so the player sees exactly what Neo built. No terrain, no
// trees, no animals — physics is the content.
import * as THREE from "three";
import { MATERIALS, type EngineWorld, type FluidBox } from "../../../engine/src/index.js";
import { modelGeometry } from "../three/geometries.js";
import { extendedModelGeometry } from "../three/extended-geometries.js";

/** Per-material render truth: metals shine, minerals stay matte. */
const MATERIAL_VISUAL: Record<string, { metalness: number; roughness: number; opacity?: number; envMapIntensity?: number }> = {
  steel: { metalness: 0.9, roughness: 0.35, envMapIntensity: 1.2 },
  iron: { metalness: 0.85, roughness: 0.5, envMapIntensity: 1.1 },
  gold: { metalness: 1.0, roughness: 0.25, envMapIntensity: 1.3 },
  copper: { metalness: 0.95, roughness: 0.3, envMapIntensity: 1.2 },
  aluminium: { metalness: 0.9, roughness: 0.4, envMapIntensity: 1.2 },
  titanium: { metalness: 0.85, roughness: 0.35, envMapIntensity: 1.2 },
  bronze: { metalness: 0.9, roughness: 0.35, envMapIntensity: 1.2 },
  lead: { metalness: 0.6, roughness: 0.6, envMapIntensity: 0.9 },
  diamond: { metalness: 0.1, roughness: 0.05, opacity: 0.7, envMapIntensity: 1.5 },
  silicon: { metalness: 0.7, roughness: 0.35, envMapIntensity: 1.1 },
  quartz: { metalness: 0.0, roughness: 0.1, opacity: 0.5, envMapIntensity: 1.4 },
  glass: { metalness: 0.0, roughness: 0.05, opacity: 0.4, envMapIntensity: 1.5 },
  ice: { metalness: 0.0, roughness: 0.1, opacity: 0.4, envMapIntensity: 1.4 },
  water: { metalness: 0.0, roughness: 0.1, opacity: 0.7, envMapIntensity: 1.4 },
  rubber: { metalness: 0.0, roughness: 0.95 },
  teflon: { metalness: 0.1, roughness: 0.4 },
};
const visualOf = (id: string) => MATERIAL_VISUAL[id] ?? { metalness: 0.05, roughness: 0.85 };

function gridTexture(): THREE.CanvasTexture {
  // Natural ground: broad soft macro-patches, mid blotches, then a whisper
  // of grain (the old heavy speckle read as confetti — caught live in-game).
  const c = document.createElement("canvas");
  c.width = 512; c.height = 512;
  const g = c.getContext("2d")!;
  // Base earth tone with subtle gradient
  g.fillStyle = "#6f744e"; g.fillRect(0, 0, 512, 512);
  // Subtle radial vignette for depth
  const vignette = g.createRadialGradient(256, 256, 100, 256, 256, 360);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = vignette; g.fillRect(0, 0, 512, 512);
  const macro = ["#66703f", "#7f8f57", "#8a7355", "#5e6840", "#7a8550"];
  // Wrapped drawing (3x3 offsets): blotches crossing an edge continue on the
  // opposite side, so the repeat shows no seams (caught live in-game).
  const blot = (x: number, y: number, r: number, col: string, alpha: string): void => {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const grad = g.createRadialGradient(x + ox * 512, y + oy * 512, 0, x + ox * 512, y + oy * 512, r);
        grad.addColorStop(0, col + alpha);
        grad.addColorStop(1, col + "00");
        g.fillStyle = grad;
        g.beginPath(); g.arc(x + ox * 512, y + oy * 512, r, 0, Math.PI * 2); g.fill();
      }
    }
  };
  // Large macro patches — broad terrain variation
  for (let i = 0; i < 50; i++) {
    const macroTones = macro[Math.floor(Math.random() * macro.length)];
    blot(Math.random() * 512, Math.random() * 512, 80 + Math.random() * 140, macroTones, "55");
  }
  // Sparse dirt: dry-earth patches break the green wash
  for (let i = 0; i < 30; i++) {
    blot(Math.random() * 512, Math.random() * 512, 50 + Math.random() * 90, "#6b5b3e", "38");
  }
  // Mid-range detail blotches
  const tones = ["#66703f", "#7f8f57", "#9a9a6e", "#8a7355", "#758052", "#a8a06b", "#5c6640"];
  for (let i = 0; i < 400; i++) {
    const col = tones[Math.floor(Math.random() * tones.length)];
    blot(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 50, col, "88");
  }
  // Fine grain speckle — subtle noise
  for (let i = 0; i < 3000; i++) {
    const v = 100 + Math.floor(Math.random() * 50);
    const a = 0.15 + Math.random() * 0.15;
    g.fillStyle = `rgba(${v},${v + 10},${v - 12},${a})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random(), 1 + Math.random());
  }
  // Occasional tiny pebbles
  for (let i = 0; i < 60; i++) {
    const px = Math.random() * 512, py = Math.random() * 512;
    const pr = 2 + Math.random() * 4;
    const pv = 80 + Math.floor(Math.random() * 40);
    g.fillStyle = `rgba(${pv},${pv + 5},${pv - 8},0.4)`;
    g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(${pv + 20},${pv + 25},${pv + 12},0.2)`;
    g.beginPath(); g.arc(px - 0.5, py - 0.5, pr * 0.7, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(250, 250);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Subtle moving shimmer shared by every fluid surface. */
function shimmerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d")!;
  // Soft blue-grey base
  g.fillStyle = "#c8d4e0"; g.fillRect(0, 0, 256, 256);
  // Caustic-like light patterns
  for (let i = 0; i < 350; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 3 + Math.random() * 18;
    const v = 180 + Math.floor(Math.random() * 75);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${v},${v + 8},${v + 16},0.45)`);
    grad.addColorStop(0.5, `rgba(${v},${v + 4},${v + 10},0.15)`);
    grad.addColorStop(1, `rgba(${v},${v + 4},${v + 10},0)`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Bright caustic highlights
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 2 + Math.random() * 6;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(4,10,6,0.85)";
  g.beginPath(); g.roundRect(6, 20, 500, 88, 20); g.fill();
  g.strokeStyle = "#8fe39a"; g.lineWidth = 3;
  g.beginPath(); g.roundRect(6, 20, 500, 88, 20); g.stroke();
  g.fillStyle = "#d7ecd2"; g.font = "bold 44px Consolas, monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text.slice(0, 26), 256, 66);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(7, 1.75, 1);
  s.renderOrder = 10;
  return s;
}

export type RigKind = "heat" | "frost" | "spark" | "laser";

export type BurstKind = "splash" | "shatter" | "blast" | "spark" | "trail" | "puff" | "fire" | "confetti" | "glow";

/** Tiny pooled GPU particle system: one THREE.Points, additive blending so
 *  fading a particle's color to black fades it out. Zero allocation per frame. */
class ParticlePool {
  points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private base: Float32Array; // base color for fade-out
  private cursor = 0;
  private geo: THREE.BufferGeometry;

  constructor(n = 1400) {
    this.n = n;
    this.pos = new Float32Array(n * 3).fill(-9999);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n).fill(1);
    this.grav = new Float32Array(n);
    this.base = new Float32Array(n * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number,
    life: number, r: number, g: number, b: number, grav: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
    this.grav[i] = grav;
  }

  burst(x: number, y: number, z: number, kind: BurstKind): void {
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    const push = (count: number, fn: (k: number) => void) => { for (let k = 0; k < count; k++) fn(k); };
    switch (kind) {
      case "splash":
        push(46, () => this.spawn(x + R(-1, 1), y + R(0, 0.4), z + R(-1, 1),
          R(-3.5, 3.5), R(2, 7), R(-3.5, 3.5), R(0.4, 0.9), 0.25, 0.55, 1.0, 9));
        break;
      case "shatter":
        push(60, () => this.spawn(x + R(-0.5, 0.5), y + R(0, 1), z + R(-0.5, 0.5),
          R(-5, 5), R(1, 6), R(-5, 5), R(0.5, 1.1), 0.85, 0.8, 0.7, 12));
        break;
      case "blast":
        push(90, () => this.spawn(x + R(-0.5, 0.5), y + R(0, 1), z + R(-0.5, 0.5),
          R(-9, 9), R(2, 11), R(-9, 9), R(0.5, 1.2), 1.0, R(0.3, 0.6), 0.1, 8));
        push(30, () => this.spawn(x + R(-1, 1), y + R(0, 1.5), z + R(-1, 1),
          R(-2, 2), R(3, 7), R(-2, 2), R(0.8, 1.6), 0.25, 0.25, 0.28, -1));
        break;
      case "spark":
        push(36, () => this.spawn(x + R(-0.3, 0.3), y + R(0, 0.5), z + R(-0.3, 0.3),
          R(-6, 6), R(-1, 5), R(-6, 6), R(0.2, 0.5), 1.0, 0.9, 0.35, 10));
        break;
      case "fire":
        push(40, () => this.spawn(x + R(-0.8, 0.8), y + R(0, 0.6), z + R(-0.8, 0.8),
          R(-1, 1), R(2, 5), R(-1, 1), R(0.5, 1.0), 1.0, R(0.25, 0.5), 0.05, -2));
        break;
      case "trail":
        push(2, () => this.spawn(x + R(-0.2, 0.2), y + R(-0.2, 0.2), z + R(-0.2, 0.2),
          R(-0.5, 0.5), R(-0.5, 0.5), R(-0.5, 0.5), R(0.3, 0.6), 0.5, 0.75, 1.0, 0));
        break;
      case "puff":
        push(16, () => this.spawn(x + R(-0.8, 0.8), y + R(0, 0.3), z + R(-0.8, 0.8),
          R(-1.5, 1.5), R(0.5, 2.5), R(-1.5, 1.5), R(0.4, 0.8), 0.45, 0.42, 0.38, 2));
        break;
      case "confetti":
        push(70, () => {
          const palette = [[1, 0.3, 0.5], [0.3, 1, 0.5], [0.4, 0.6, 1], [1, 0.9, 0.3], [1, 0.55, 0.2]];
          const c = palette[Math.floor(Math.random() * palette.length)];
          this.spawn(x + R(-1, 1), y + R(0, 2), z + R(-1, 1),
            R(-4, 4), R(3, 8), R(-4, 4), R(0.8, 1.6), c[0], c[1], c[2], 6);
        });
        break;
      case "glow":
        push(24, () => this.spawn(x + R(-1, 1), y + R(0, 1), z + R(-1, 1),
          R(-0.4, 0.4), R(0.5, 1.5), R(-0.4, 0.4), R(0.6, 1.2), 0.4, 1.0, 0.6, -1));
        break;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -9999;
        this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.vel[i * 3 + 1] < 0) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] *= -0.4; // bounce off the plane
      }
      const f = this.life[i] / this.maxLife[i];
      this.col[i * 3] = this.base[i * 3] * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

export class PlaneWorld {
  group = new THREE.Group();
  private ground: THREE.Mesh;
  private meshes = new Map<string, THREE.Object3D>();
  private fluidGroup = new THREE.Group();
  private fluidKey = "";
  private fluidSurfaces: THREE.Mesh[] = [];
  private marker = new THREE.Group();
  private rig = new THREE.Group();
  private rigLight: THREE.PointLight;
  private bolt: THREE.Line | null = null;
  private ring: THREE.Mesh | null = null;
  private rigBase = 0;
  private particles = new ParticlePool();
  private prevStates = new Map<string, { broken: boolean; molten: boolean; burning: boolean; events: number; vy: number; y: number }>();
  private shakeAmp = 0;
  private frame = 0;
  private shimmer = shimmerTexture();

  constructor() {
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 1, metalness: 0 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    // No decoration: the plane is the world. Rocks/grass/trees would violate
    // NEOGENESIS_RULES Law 2 (no biomes, no vegetation, no decoration, ever).
    this.group.add(this.fluidGroup);
    this.group.add(this.marker);
    this.group.add(this.rig);
    // Rig flash: physical decay=2 (1/d² — real propagation falloff). At lab
    // scale light crosses the scene in microseconds, so flashes apply
    // immediately and honestly; the engine verdicts quote the microseconds.
    this.rigLight = new THREE.PointLight(0xff5a00, 0, 30, 2);
    this.group.add(this.rigLight);
    this.group.add(this.particles.points);
  }

  /** Celebration / impact particles anyone can trigger (terminal fun commands too). */
  burst(x: number, y: number, z: number, kind: BurstKind): void {
    this.particles.burst(x, y, z, kind);
    if (kind === "blast" || kind === "shatter") this.addShake(kind === "blast" ? 0.9 : 0.5);
  }

  addShake(a: number): void {
    this.shakeAmp = Math.min(1.4, this.shakeAmp + a);
  }

  /** Decaying shake amplitude for the camera — call once per frame. */
  consumeShake(): number {
    const s = this.shakeAmp;
    this.shakeAmp *= 0.88;
    if (this.shakeAmp < 0.01) this.shakeAmp = 0;
    return s;
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
        const v = visualOf(b.material.id);
        const mat = new THREE.MeshStandardMaterial({
          color, roughness: v.roughness, metalness: v.metalness,
          envMapIntensity: v.envMapIntensity ?? 0.7,
        });
        if (v.opacity !== undefined) { mat.transparent = true; mat.opacity = v.opacity; }
        // Class-specific geometry: each model class gets a distinctive 3D shape.
        let classGeo = b.modelClass ? modelGeometry(b.modelClass, b.radiusM) : null;
        if (!classGeo && b.modelClass) classGeo = extendedModelGeometry(b.modelClass, b.radiusM);
        if (classGeo) {
          m = new THREE.Mesh(classGeo, mat);
        } else if (b.shape === "sphere") {
          m = new THREE.Mesh(new THREE.SphereGeometry(b.radiusM, 32, 24), mat);
        } else {
          const geo = new THREE.BoxGeometry(
            (b.halfM ? b.halfM.x : b.radiusM) * 2,
            (b.halfM ? b.halfM.y : b.radiusM) * 2,
            (b.halfM ? b.halfM.z : b.radiusM) * 2);
          m = new THREE.Mesh(geo, mat);
          // crate edges — boxes read as built objects, not flat fills
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0x14160f, transparent: true, opacity: 0.4 }));
          m.add(edges);
        }
        m.castShadow = true;
        (m.userData as Record<string, unknown>).baseColor = color;
        this.group.add(m);
        this.meshes.set(b.id, m);
      }
      m.position.set(b.pos.x, b.pos.y, b.pos.z);
      const u0 = (m as THREE.Object3D & { userData: Record<string, unknown> }).userData;
      // Tumble: the engine integrates orientation from spin — the mesh shows it.
      // Shatter-tilt adds on top (stored once, applied every frame).
      m.rotation.set(
        b.rot.x + ((u0.tiltX as number) ?? 0),
        b.rot.y + ((u0.tiltY as number) ?? 0),
        b.rot.z + ((u0.tiltZ as number) ?? 0));
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const u = (m as THREE.Object3D & { userData: Record<string, unknown> }).userData;
      if (b.broken && !u.crushed) { u.crushed = true; m.scale.y *= 0.45; mat.color.multiplyScalar(0.55); }
      if (b.molten) mat.emissive.setHex(0xff5a00).multiplyScalar(0.7);
      else if (b.burning) mat.emissive.setHex(0xff2200).multiplyScalar(0.5);
      // ---- event-driven FX: births, splashes, shatters, rests, trails ----
      const prev = this.prevStates.get(b.id);
      const speed = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
      if (!prev) {
        this.prevStates.set(b.id, { broken: b.broken, molten: b.molten, burning: b.burning, events: b.events.length, vy: b.vel.y, y: b.pos.y });
        if (this.frame > 5) this.particles.burst(b.pos.x, b.pos.y, b.pos.z, "puff");
      } else {
        if (!prev.broken && b.broken) {
          this.particles.burst(b.pos.x, Math.max(0.5, b.pos.y), b.pos.z, "shatter");
          this.addShake(0.55);
        }
        if ((!prev.molten && b.molten) || (!prev.burning && b.burning)) {
          this.particles.burst(b.pos.x, b.pos.y, b.pos.z, "fire");
        }
        if (b.events.length > prev.events) {
          for (const e of b.events.slice(prev.events)) {
            if (e.includes("SPLASH")) this.particles.burst(b.pos.x, Math.max(0.3, b.pos.y), b.pos.z, "splash");
            else if (e.includes("came to rest")) this.particles.burst(b.pos.x, 0.3, b.pos.z, "puff");
            else if (e.includes("SHATTER") || e.includes("shattered") || e.includes("broke")) {
              this.particles.burst(b.pos.x, Math.max(0.5, b.pos.y), b.pos.z, "shatter");
              this.addShake(0.4);
            } else if (e.includes("IGNIT") || e.includes("MELT")) {
              this.particles.burst(b.pos.x, b.pos.y, b.pos.z, "fire");
            }
          }
          prev.events = b.events.length;
        }
        // Hard landing: fast fall → sudden stop = dust + thud + squash.
        const wasFalling = prev.vy < -9;
        const stopped = Math.abs(b.vel.y) < 2.5 && b.pos.y < 3;
        if (wasFalling && stopped && !b.broken) {
          this.particles.burst(b.pos.x, 0.25, b.pos.z, "puff");
          this.addShake(0.3);
          u.squashT = 0.28;
        }
        // Speed trails for screaming-fast bodies (lightspeed throws streak).
        if (speed > 25 && this.frame % 2 === 0) {
          this.particles.burst(b.pos.x, b.pos.y, b.pos.z, "trail");
        }
        // Sizzle: bodies sitting in lava spit fire while they cook.
        if (b.fluid && /lava/i.test(b.fluid) && this.frame % 8 === 0) {
          this.particles.burst(b.pos.x, Math.max(0.5, b.pos.y), b.pos.z, "fire");
        }
        prev.broken = b.broken; prev.molten = b.molten; prev.burning = b.burning;
        prev.vy = b.vel.y; prev.y = b.pos.y;
      }
    }
    for (const [id, m] of this.meshes) {
      if (!seen.has(id)) { this.group.remove(m); this.meshes.delete(id); this.prevStates.delete(id); }
    }
    this.frame++;
  }

  /** Ground ring + floating label at Neo's rig — the player sees what Neo built. */
  showMarker(x: number, z: number, label: string): void {
    this.clearMarker();
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0x8fe39a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(x, 0.06, z);
    const tag = labelSprite(label);
    tag.position.set(x, 4.2, z);
    this.marker.add(this.ring, tag);
  }

  clearMarker(): void {
    this.marker.clear();
    this.ring = null;
  }

  /** Rig props per experiment kind — chamber, spark gap, or laser bench. */
  setRig(kind: RigKind | null, x: number, z: number, size: number): void {
    this.rig.clear();
    this.bolt = null;
    this.rigLight.intensity = 0;
    this.rigBase = 0;
    if (!kind) return;
    if (kind === "heat" || kind === "frost") {
      const hot = kind === "heat";
      const chamberSize = size * 2 + 1.6;
      // Outer glass chamber
      const chamber = new THREE.Mesh(new THREE.BoxGeometry(chamberSize, chamberSize, chamberSize),
        new THREE.MeshStandardMaterial({
          color: hot ? 0xff5a00 : 0x4aa8ff, transparent: true, opacity: 0.12,
          roughness: 0.05, emissive: hot ? 0xff4400 : 0x2266ff, emissiveIntensity: 0.6,
          side: THREE.DoubleSide, depthWrite: false,
        }));
      chamber.position.set(x, size + 0.4, z);
      this.rig.add(chamber);
      // Inner glow core
      const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.4, 16, 12),
        new THREE.MeshStandardMaterial({
          color: hot ? 0xff8800 : 0x66bbff, transparent: true, opacity: 0.3,
          emissive: hot ? 0xff6600 : 0x4499ff, emissiveIntensity: 1.2,
        }));
      core.position.set(x, size + 0.4, z);
      this.rig.add(core);
      // Heat coils (hot only)
      if (hot) {
        const coilMat = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff2200, emissiveIntensity: 0.8, roughness: 0.6 });
        for (let i = 0; i < 4; i++) {
          const coil = new THREE.Mesh(new THREE.TorusGeometry(size * 0.6, 0.04, 8, 24), coilMat);
          coil.position.set(x, size * 0.3 + i * size * 0.5, z);
          coil.rotation.x = Math.PI / 2;
          this.rig.add(coil);
        }
      }
      // Frost crystals (frost only)
      if (!hot) {
        const iceMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.5, roughness: 0.1, metalness: 0.3 });
        for (let i = 0; i < 6; i++) {
          const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), iceMat);
          const a = (i / 6) * Math.PI * 2;
          crystal.position.set(x + Math.cos(a) * size * 0.5, size * 0.2 + Math.random() * size, z + Math.sin(a) * size * 0.5);
          crystal.rotation.set(Math.random(), Math.random(), Math.random());
          this.rig.add(crystal);
        }
      }
      this.rigLight.color.setHex(hot ? 0xff6a00 : 0x4aa8ff);
      this.rigLight.position.set(x, size + 3, z);
      this.rigBase = 60;
    } else if (kind === "spark") {
      const rodMat = new THREE.MeshStandardMaterial({ color: 0x7d848a, metalness: 0.9, roughness: 0.35 });
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.5 });
      // Base plate
      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 1.2), baseMat);
      basePlate.position.set(x, 0.075, z);
      basePlate.castShadow = true;
      this.rig.add(basePlate);
      // Insulator blocks
      const insulMat = new THREE.MeshStandardMaterial({ color: 0x8a6040, roughness: 0.8 });
      for (const dx of [-1.2, 1.2]) {
        const insul = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.35), insulMat);
        insul.position.set(x + dx, 0.4, z);
        this.rig.add(insul);
      }
      // Electrode rods with tapered tips
      for (const dx of [-1.2, 1.2]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.0, 8), rodMat);
        rod.position.set(x + dx, 1.9, z);
        rod.castShadow = true;
        this.rig.add(rod);
        // Tip sphere
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), rodMat);
        tip.position.set(x + dx, 3.4, z);
        this.rig.add(tip);
      }
      // High-voltage cables (curved lines from base to rod tops)
      const cableMat = new THREE.LineBasicMaterial({ color: 0x222222 });
      for (const dx of [-1.2, 1.2]) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          pts.push(new THREE.Vector3(x + dx, 0.5 + t * 2.9 + Math.sin(t * Math.PI) * 0.2, z + 0.4));
        }
        const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat);
        this.rig.add(cable);
      }
      // Jagged bolt between the rods
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        pts.push(new THREE.Vector3(
          x - 1.2 + (2.4 * i) / 10 + (i % 2 ? 0.3 : -0.15),
          3.2 - i * 0.08 + (i % 3 === 0 ? 0.15 : 0),
          z + (i % 2 ? 0.08 : -0.08)));
      }
      this.bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xfff36b, linewidth: 2 }));
      this.rig.add(this.bolt);
      // Secondary bolt (thinner, offset)
      const pts2: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        pts2.push(new THREE.Vector3(
          x - 1.1 + (2.2 * i) / 8 + (i % 2 ? -0.2 : 0.15),
          3.15 - i * 0.1 + (i % 2 ? 0.1 : -0.05),
          z - 0.12));
      }
      const bolt2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2),
        new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.6 }));
      this.rig.add(bolt2);
      this.rigLight.color.setHex(0xfff36b);
      this.rigLight.position.set(x, 3.4, z);
      this.rigBase = 40;
    } else if (kind === "laser") {
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.85, roughness: 0.3 });
      const accentMat = new THREE.MeshStandardMaterial({ color: 0x22aa44, emissive: 0x116622, emissiveIntensity: 0.5 });
      // Optical bench (long rail)
      const bench = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.8), metalMat);
      bench.position.set(x - 0.5, 0.06, z);
      bench.castShadow = true;
      this.rig.add(bench);
      // Rail grooves
      for (const dz of [-0.25, 0.25]) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.03, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 }));
        groove.position.set(x - 0.5, 0.13, z + dz);
        this.rig.add(groove);
      }
      // Emitter housing (cylindrical with lens)
      const emitterBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 12), metalMat);
      emitterBody.rotation.z = Math.PI / 2;
      emitterBody.position.set(x - 4.5, size + 0.4, z);
      emitterBody.castShadow = true;
      this.rig.add(emitterBody);
      // Emitter lens
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xff4444, transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.1 }));
      lens.rotation.z = -Math.PI / 2;
      lens.position.set(x - 4.1, size + 0.4, z);
      this.rig.add(lens);
      // Target (detector on the other end)
      const target = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7, roughness: 0.4 }));
      target.rotation.z = Math.PI / 2;
      target.position.set(x + 3.8, size + 0.4, z);
      this.rig.add(target);
      // Target crosshair
      const crossMat = new THREE.LineBasicMaterial({ color: 0x22cc44 });
      const ch1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x + 3.8, size + 0.15, z),
        new THREE.Vector3(x + 3.8, size + 0.65, z)]), crossMat);
      const ch2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x + 3.8, size + 0.4, z - 0.3),
        new THREE.Vector3(x + 3.8, size + 0.4, z + 0.3)]), crossMat);
      this.rig.add(ch1, ch2);
      // Support posts
      for (const dx of [-4.5, -1, 2, 3.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, size + 0.3, 6), metalMat);
        post.position.set(x + dx, (size + 0.3) / 2, z);
        this.rig.add(post);
      }
      // Laser beam (glowing line with glow sprite)
      const beam = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2.4 }));
      beam.position.set(x - 0.35, size + 0.4, z);
      this.rig.add(beam);
      // Beam glow halo
      const glow = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
      glow.position.set(x - 0.35, size + 0.4, z);
      this.rig.add(glow);
      // Power indicator LED
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 1.5 }));
      led.position.set(x - 4.5, size + 0.8, z);
      this.rig.add(led);
      this.rigLight.color.setHex(0xff2020);
      this.rigLight.position.set(x, size + 1.5, z);
      this.rigBase = 25;
    }
  }

  /** Per-frame rig animation + melt/char deformation. Needs the world to read body state. */
  tick(_dt: number, elapsed: number, world?: EngineWorld): void {
    if (this.ring) {
      const s = 1 + 0.07 * Math.sin(elapsed * 3);
      this.ring.scale.set(s, s, 1);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.25 * Math.sin(elapsed * 3);
    }
    if (this.bolt) this.bolt.visible = elapsed * 9 % 1 < 0.55;
    if (this.rigBase > 0) this.rigLight.intensity = this.rigBase + Math.sin(elapsed * 11) * this.rigBase * 0.12;
    // Living water: surfaces breathe, shimmer drifts, lava pulses.
    this.shimmer.offset.x += Math.min(0.05, _dt) * 0.02;
    this.shimmer.offset.y += Math.min(0.05, _dt) * 0.013;
    for (let i = 0; i < this.fluidSurfaces.length; i++) {
      const s = this.fluidSurfaces[i];
      s.position.y += Math.sin(elapsed * 2.2 + i * 1.7) * 0.0009;
      const sm = s.material as THREE.MeshStandardMaterial;
      if (sm.emissiveIntensity !== undefined && sm.emissive.getHex() !== 0) {
        sm.emissiveIntensity = 0.7 + 0.3 * Math.sin(elapsed * 5 + i);
      }
    }
    this.particles.update(Math.min(0.05, _dt));
    if (!world) return;
    const dt = Math.min(0.05, _dt);
    for (const b of world.bodies) {
      const m = this.meshes.get(b.id) as THREE.Mesh | undefined;
      if (!m) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      const u = m.userData as Record<string, unknown>;
      const base = new THREE.Color((u.baseColor as number) ?? 0x888888);
      if (b.molten) {
        // Melting, visibly: slump into a spreading puddle, never a floating cube.
        if (u.baseY === undefined) u.baseY = b.pos.y;
        const mt = Math.min(1, ((u.melt01 as number) ?? 0) + dt * 0.3);
        u.melt01 = mt;
        const crushed = u.crushed ? 0.45 : 1;
        m.scale.set(1 + 0.8 * mt, crushed * (1 - 0.85 * mt), 1 + 0.8 * mt);
        m.position.y = (u.baseY as number) * (1 - 0.8 * mt);
        mat.color.copy(base).lerp(new THREE.Color(0x7a2a00), mt * 0.5);
      } else if (b.burning) {
        // Burning chars: surface blackens while the shape holds.
        const ch = Math.min(0.8, ((u.char01 as number) ?? 0) + dt * 0.2);
        u.char01 = ch;
        mat.color.copy(base).lerp(new THREE.Color(0x111111), ch);
        // Flickering fire glow while burning.
        mat.emissive.setHex(0xff3300).multiplyScalar(0.35 + 0.2 * Math.sin(elapsed * 17 + b.pos.x));
      }
      // Landing squash-and-stretch recovery.
      const sq = (u.squashT as number) ?? 0;
      if (sq > 0) {
        u.squashT = sq - dt;
        const k = Math.max(0, (u.squashT as number)) / 0.28;
        const crushed = u.crushed ? 0.45 : 1;
        m.scale.set(1 + 0.25 * k, crushed * (1 - 0.3 * k), 1 + 0.25 * k);
        if ((u.squashT as number) <= 0 && !b.molten) m.scale.set(1, crushed, 1);
      }
      // Shattered shards keep a slight tilt — wreckage reads as wreckage.
      // Stored as offsets; the per-frame rotation above adds engine tumble.
      if (b.broken && !u.tilted) {
        u.tilted = true;
        u.tiltX = (Math.random() - 0.5) * 0.35;
        u.tiltY = Math.random() * Math.PI;
        u.tiltZ = (Math.random() - 0.5) * 0.35;
      }
    }
  }

  private static fluidColor(name: string): { color: number; emissive?: number } {
    const n = name.toLowerCase();
    if (n.includes("acid") || n.includes("bleach") || n.includes("drain cleaner")) return { color: 0x39d353, emissive: 0x0a3d1a };
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
    this.fluidSurfaces = [];
    for (const f of fluids) {
      const w = f.max.x - f.min.x, h = f.max.y - f.min.y, d = f.max.z - f.min.z;
      if (w <= 0 || h <= 0 || d <= 0) continue;
      const { color, emissive } = PlaneWorld.fluidColor(f.name);
      const isLava = /lava/i.test(f.name);
      // Volume body — slightly inset to avoid z-fighting with walls
      const vol = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, h - 0.02, d - 0.02),
        new THREE.MeshStandardMaterial({
          color, transparent: true, opacity: isLava ? 0.7 : 0.35,
          roughness: isLava ? 0.6 : 0.08, depthWrite: false,
          emissive: emissive ?? 0x000000, emissiveIntensity: isLava ? 0.6 : 0,
        }));
      vol.position.set((f.min.x + f.max.x) / 2, (f.min.y + f.max.y) / 2, (f.min.z + f.max.z) / 2);
      vol.renderOrder = 1;
      // Surface with caustic shimmer
      const surf = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({
          color, transparent: true, opacity: isLava ? 0.9 : 0.75,
          roughness: isLava ? 0.5 : 0.03, map: this.shimmer, envMapIntensity: 1.4,
          emissive: emissive ?? 0x000000, emissiveIntensity: emissive ? 0.9 : 0,
        }));
      surf.rotation.x = -Math.PI / 2;
      surf.position.set((f.min.x + f.max.x) / 2, f.max.y + 0.01, (f.min.z + f.max.z) / 2);
      surf.renderOrder = 2;
      // Edge meniscus — thin bright ring at fluid surface edge for realism
      const edgeMat = new THREE.MeshBasicMaterial({
        color: isLava ? 0xffaa44 : 0xffffff, transparent: true, opacity: isLava ? 0.4 : 0.12,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.15, d + 0.15), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set((f.min.x + f.max.x) / 2, f.max.y + 0.02, (f.min.z + f.max.z) / 2);
      edge.renderOrder = 3;
      this.fluidGroup.add(vol, surf, edge);
      this.fluidSurfaces.push(surf);
    }
  }
}
