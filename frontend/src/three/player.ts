// Cinematic first-person controller: walk/run/crouch/swim/climb stubs, subtle weight, no shake spam.
import * as THREE from "three";

/** Minimal body surface the collider needs — the engine Body satisfies this. */
export interface PushableBody { vel: { x: number; y: number; z: number }; hasMoved: boolean; settled: boolean }
export interface PlayerBodyLike {
  pos: { x: number; y: number; z: number }; shape: string; radiusM: number;
  halfM?: { x: number; y: number; z: number }; massKg: number;
  isStatic: boolean; ghost: boolean; vel: { x: number; y: number; z: number };
  hasMoved: boolean; settled: boolean;
}
export interface Collider {
  x: number; z: number; r: number; top: number;
  massKg: number; pushable: boolean; ref: PushableBody;
}
/** The player's shove weight: 80 kg body + momentum, capped like a sprinting shove. */
export const PLAYER_MASS_KG = 80;

/** Build the collider set from live bodies: ghost cores are invisible (never
 *  walls), distant bodies are culled, statics block but never move. */
export function buildColliders(bodies: PlayerBodyLike[], px: number, pz: number): Collider[] {
  const out: Collider[] = [];
  for (const b of bodies) {
    if (b.ghost) continue;
    const dx = b.pos.x - px, dz = b.pos.z - pz;
    if (dx * dx + dz * dz > 1600) continue; // beyond 40 m, ignore
    out.push({
      x: b.pos.x, z: b.pos.z,
      r: b.shape === "sphere" ? b.radiusM : Math.max(b.halfM?.x ?? b.radiusM, b.halfM?.z ?? b.radiusM),
      top: b.pos.y + (b.shape === "sphere" ? b.radiusM : (b.halfM?.y ?? b.radiusM)),
      massKg: b.massKg, pushable: !b.isStatic, ref: b,
    });
  }
  return out;
}

/** True while the user is writing in a text field — game keys must stand down. */
export function uiHasFocus(e?: Event): boolean {
  const t = (e?.target ?? document.activeElement) as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export interface MoveState { f: boolean; b: boolean; l: boolean; r: boolean; run: boolean; crouch: boolean; jump: boolean }

export class PlayerController {
  obj = new THREE.Object3D(); // yaw holder, at the feet
  pitch = new THREE.Object3D(); // pitch holder, at EYE height (see below)
  camera: THREE.PerspectiveCamera;
  vel = new THREE.Vector3();
  grounded = true;
  eyeHeight = 1.7;
  private eyeCur = 1.7; // crouch eases this, never the camera directly
  private shakeX = 0; private shakeY = 0; // impact offsets, decayed per frame
  gravity = 12.5;   // set 9.80665 for real Earth (engine-owned games do this)
  maxFall = 54;     // human terminal velocity, m/s
  keys: MoveState = { f: false, b: false, l: false, r: false, run: false, crouch: false, jump: false };
  private jumpBuf = 0; // tap insurance: a Space tap shorter than one frame
  // still jumps (polled keys.jump alone misses sub-frame taps, real bug).
  /** Hard stop: release every key and kill drift velocity. */
  stop(): void {
    this.keys = { f: false, b: false, l: false, r: false, run: false, crouch: false, jump: false };
    this.vel.set(0, 0, 0);
  }
  /** Impact shake: accumulates into dedicated offsets — head-bob owns
   * camera.position.x and used to overwrite shake offsets every frame, which
   * erased horizontal shake and leaked vertical shake into the eye lerp. */
  kick(x: number, y: number): void {
    this.shakeX = THREE.MathUtils.clamp(this.shakeX + x, -0.5, 0.5);
    this.shakeY = THREE.MathUtils.clamp(this.shakeY + y, -0.5, 0.5);
  }
  /** Face a world point (yaw only). Pitch is the player's eyes — left alone. */
  lookAt(x: number, z: number): void {
    const dx = x - this.obj.position.x, dz = z - this.obj.position.z;
    this.obj.rotation.y = Math.atan2(-dx, -dz);
  }
  /** Teleport feet to (x, z): kills velocity (no arrival drift) and optionally
   * levels the view so experiments start framed, not staring at old sky. */
  teleport(x: number, z: number, levelView: boolean): void {
    this.obj.position.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.shakeX = 0; this.shakeY = 0;
    if (levelView) this.pitch.rotation.x = 0;
    this.pitch.position.set(0, this.eyeCur, 0);
  }
  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    // Pivot at the EYES, not the feet: rotating pitch must turn the view in
    // place. The old rig pivoted at the feet, so looking down swung the
    // camera in a 1.7 m arc straight into the ground.
    this.pitch.position.set(0, this.eyeCur, 0);
    this.obj.add(this.pitch);
    this.pitch.add(camera);
    camera.position.set(0, 0, 0);
  }
  attach(el: HTMLElement) {
    el.addEventListener("click", () => el.requestPointerLock?.());
    // Clicking into any text field releases all movement keys — no stuck strafe.
    window.addEventListener("focusin", (e) => {
      if (uiHasFocus(e)) this.stop();
    });
    // Alt+Tab (or any blur) swallows keyup — stop dead instead of drifting forever.
    window.addEventListener("blur", () => this.stop());
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.stop(); });
    document.addEventListener("pointerlockchange", () => {});
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== el) return;
      this.obj.rotation.y -= e.movementX * 0.0022;
      this.pitch.rotation.x = THREE.MathUtils.clamp(this.pitch.rotation.x - e.movementY * 0.0022, -1.45, 1.45);
    });
    // Touch/drag fallback
    let dragging = false, lx = 0, ly = 0;
    el.addEventListener("mousedown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
    window.addEventListener("mouseup", () => (dragging = false));
    window.addEventListener("mousemove", (e) => {
      if (dragging && document.pointerLockElement !== el) {
        this.obj.rotation.y -= (e.clientX - lx) * 0.004;
        this.pitch.rotation.x = THREE.MathUtils.clamp(this.pitch.rotation.x - (e.clientY - ly) * 0.004, -1.45, 1.45);
        lx = e.clientX; ly = e.clientY;
      }
    });
    window.addEventListener("keydown", (e) => { if (!uiHasFocus(e)) this.setKey(e.code, true); });
    window.addEventListener("keyup", (e) => { if (!uiHasFocus(e)) this.setKey(e.code, false); });
  }
  private setKey(code: string, on: boolean) {
    if (code === "KeyW" || code === "ArrowUp") this.keys.f = on;
    if (code === "KeyS" || code === "ArrowDown") this.keys.b = on;
    if (code === "KeyA" || code === "ArrowLeft") this.keys.l = on;
    if (code === "KeyD" || code === "ArrowRight") this.keys.r = on;
    if (code === "ShiftLeft" || code === "ShiftRight") this.keys.run = on;
    if (code === "KeyC") this.keys.crouch = on;
    if (code === "Space") { this.keys.jump = on; if (on) this.jumpBuf = 0.15; }
  }
  update(dt: number, groundY: number, inWater: boolean,
    opts?: { colliders?: Collider[]; grade?: number }) {
    let speed = this.keys.crouch ? 1.6 : this.keys.run ? 7.5 : 4.2;
    // Uphill costs effort, downhill is free — movement has physical weight.
    const grade = opts?.grade ?? 0;
    speed *= THREE.MathUtils.clamp(1 / (1 + Math.max(0, grade) * 2.5), 0.35, 1.12);
    const dir = new THREE.Vector3(
      (this.keys.r ? 1 : 0) - (this.keys.l ? 1 : 0), 0,
      (this.keys.b ? 1 : 0) - (this.keys.f ? 1 : 0));
    dir.normalize().applyQuaternion(this.obj.quaternion);
    const accel = this.grounded ? 26 : 6;
    this.vel.x += (dir.x * speed - this.vel.x) * Math.min(1, accel * dt / Math.max(1, speed));
    this.vel.z += (dir.z * speed - this.vel.z) * Math.min(1, accel * dt / Math.max(1, speed));
    // Idle hard stop: no keys, no drift — kills asymptotic creep and phantom footsteps.
    if (!this.keys.f && !this.keys.b && !this.keys.l && !this.keys.r) {
      this.vel.x *= Math.max(0, 1 - 10 * dt);
      this.vel.z *= Math.max(0, 1 - 10 * dt);
      if (Math.hypot(this.vel.x, this.vel.z) < 0.05) { this.vel.x = 0; this.vel.z = 0; }
    }
    if (inWater) { this.vel.x *= 0.55; this.vel.z *= 0.55; }
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    if ((this.keys.jump || this.jumpBuf > 0) && this.grounded) {
      this.vel.y = 4.6; this.grounded = false; this.jumpBuf = 0;
    }
    this.vel.y -= this.gravity * dt;
    if (this.vel.y < -this.maxFall) this.vel.y = -this.maxFall;
    this.obj.position.addScaledVector(this.vel, dt);
    // Perfect collider: feet above an object's top pass clean over (jump over
    // AND onto); sides never pass through; weight decides pushes — an 80 kg
    // human shoves crates aside but bounces off lead blocks and tank walls.
    const cols = opts?.colliders;
    const feetY = this.obj.position.y;
    const pr = 0.45;
    let support = groundY;
    if (cols) {
      for (const c of cols) {
        const dx0 = this.obj.position.x - c.x, dz0 = this.obj.position.z - c.z;
        if (dx0 * dx0 + dz0 * dz0 < (c.r + pr) * (c.r + pr) && feetY >= c.top - 0.35) {
          if (c.top > support) support = c.top; // stand on it
        }
      }
    }
    if (cols) {
      const pushMass = PLAYER_MASS_KG + Math.hypot(this.vel.x, this.vel.z) * 5;
      for (let pass = 0; pass < 2; pass++) {
        for (const c of cols) {
          if (feetY > c.top - 0.08) continue; // airborne above it — no touch
          const dx = this.obj.position.x - c.x, dz = this.obj.position.z - c.z;
          const min = c.r + pr;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min && d2 > 1e-8) {
            const d = Math.sqrt(d2), push = (min - d) / d;
            const nx = dx / d, nz = dz / d;
            if (c.pushable && pushMass >= c.massKg) {
              // Shove: overlap converts to body velocity (capped, no cannoning),
              // the body wakes, the player pays effort. Weight wins, honestly.
              const strength = Math.min(1.5, Math.max(0.4, pushMass / Math.max(1, c.massKg)));
              const bSpeed = Math.hypot(c.ref.vel.x, c.ref.vel.z);
              if (bSpeed < 6) {
                const gift = Math.min((min - d) * 8, 2.5) * strength;
                c.ref.vel.x += nx * gift;
                c.ref.vel.z += nz * gift;
                c.ref.hasMoved = true;
                c.ref.settled = false;
              }
              this.obj.position.x += dx * push * 0.15;
              this.obj.position.z += dz * push * 0.15;
              this.vel.x *= 0.85; this.vel.z *= 0.85;
            } else {
              // Blocked: push out; inward velocity dies — except a held jump
              // against a LOW obstacle keeps half its run-up, so a running
              // jump carries over instead of dying at the edge.
              this.obj.position.x += dx * push;
              this.obj.position.z += dz * push;
              const soft = this.keys.jump && c.top < 1.0 ? 0.5 : 1.0;
              const vn = this.vel.x * nx + this.vel.z * nz;
              if (vn < 0) { this.vel.x -= nx * vn * soft; this.vel.z -= nz * vn * soft; }
            }
          } else if (d2 <= 1e-8) {
            this.obj.position.x += min; // dead-center: eject along +x
          }
        }
      }
    }
    // Eyes ride the pitch holder: crouch eases eye height, shake adds a
    // decaying offset, and the holder is composed fresh every frame so the
    // two can never fight (the old camera.position.y lerp did).
    const eyeTarget = this.keys.crouch ? 1.05 : this.eyeHeight;
    this.eyeCur += (eyeTarget - this.eyeCur) * Math.min(1, 10 * dt);
    const shK = Math.max(0, 1 - 7 * dt);
    this.shakeX *= shK; this.shakeY *= shK;
    if (Math.abs(this.shakeX) < 1e-4) this.shakeX = 0;
    if (Math.abs(this.shakeY) < 1e-4) this.shakeY = 0;
    this.pitch.position.set(this.shakeX, this.eyeCur + this.shakeY, 0);
    const landY = Math.max(groundY, support);
    if (this.obj.position.y <= landY) {
      this.obj.position.y = landY; this.vel.y = 0; this.grounded = true;
    } else if (this.obj.position.y > landY + 0.02) {
      this.grounded = false; // walked off an edge — airborne, gravity owns us
    }
    // Eyes never clip underground on steep ground.
    const minEye = groundY + 0.4;
    if (this.obj.position.y + this.pitch.position.y < minEye) {
      this.obj.position.y = minEye - this.pitch.position.y;
    }
    // Subtle head-bob (weight, not shake). Owns camera.position.x outright —
    // impact shake lives in the pitch offsets (see kick()), never here.
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const t = performance.now() / 1000;
    this.camera.position.x = Math.sin(t * (4 + hSpeed)) * 0.018 * Math.min(1, hSpeed / 4);
    this.camera.position.y = 0;
    this.camera.position.z = 0;
  }
}
