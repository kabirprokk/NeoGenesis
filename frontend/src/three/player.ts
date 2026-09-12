// Cinematic first-person controller: walk/run/crouch/swim/climb stubs, subtle weight, no shake spam.
import * as THREE from "three";

export interface MoveState { f: boolean; b: boolean; l: boolean; r: boolean; run: boolean; crouch: boolean; jump: boolean }

export class PlayerController {
  obj = new THREE.Object3D(); // yaw holder
  pitch = new THREE.Object3D(); // pitch holder (camera child)
  camera: THREE.PerspectiveCamera;
  vel = new THREE.Vector3();
  grounded = true;
  eyeHeight = 1.7;
  gravity = 12.5;   // set 9.80665 for real Earth (engine-owned games do this)
  maxFall = 54;     // human terminal velocity, m/s
  keys: MoveState = { f: false, b: false, l: false, r: false, run: false, crouch: false, jump: false };
  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.obj.add(this.pitch);
    this.pitch.add(camera);
    camera.position.set(0, this.eyeHeight, 0);
  }
  attach(el: HTMLElement) {
    el.addEventListener("click", () => el.requestPointerLock?.());
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
    window.addEventListener("keydown", (e) => this.setKey(e.code, true));
    window.addEventListener("keyup", (e) => this.setKey(e.code, false));
  }
  private setKey(code: string, on: boolean) {
    if (code === "KeyW" || code === "ArrowUp") this.keys.f = on;
    if (code === "KeyS" || code === "ArrowDown") this.keys.b = on;
    if (code === "KeyA" || code === "ArrowLeft") this.keys.l = on;
    if (code === "KeyD" || code === "ArrowRight") this.keys.r = on;
    if (code === "ShiftLeft" || code === "ShiftRight") this.keys.run = on;
    if (code === "KeyC") this.keys.crouch = on;
    if (code === "Space") this.keys.jump = on;
  }
  update(dt: number, groundY: number, inWater: boolean,
    opts?: { colliders?: { x: number; z: number; r: number }[]; grade?: number }) {
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
    if (inWater) { this.vel.x *= 0.55; this.vel.z *= 0.55; }
    if (this.keys.jump && this.grounded) { this.vel.y = 4.6; this.grounded = false; }
    this.vel.y -= this.gravity * dt;
    if (this.vel.y < -this.maxFall) this.vel.y = -this.maxFall;
    this.obj.position.addScaledVector(this.vel, dt);
    // Solid world: trees, boulders, and animals push back (two relaxation passes).
    const cols = opts?.colliders;
    if (cols) {
      const pr = 0.45;
      for (let pass = 0; pass < 2; pass++) {
        for (const c of cols) {
          const dx = this.obj.position.x - c.x, dz = this.obj.position.z - c.z;
          const min = c.r + pr;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min && d2 > 1e-8) {
            const d = Math.sqrt(d2), push = (min - d) / d;
            this.obj.position.x += dx * push;
            this.obj.position.z += dz * push;
          } else if (d2 <= 1e-8) {
            this.obj.position.x += min; // dead-center: eject along +x
          }
        }
      }
    }
    const eyeTarget = this.keys.crouch ? 1.05 : this.eyeHeight;
    this.camera.position.y += (eyeTarget - this.camera.position.y) * Math.min(1, 10 * dt);
    if (this.obj.position.y <= groundY) {
      this.obj.position.y = groundY; this.vel.y = 0; this.grounded = true;
    }
    // Camera never clips underground on steep ground.
    const minEye = groundY + 0.4;
    if (this.obj.position.y + this.camera.position.y < minEye) {
      this.obj.position.y = minEye - this.camera.position.y;
    }
    // Subtle head-bob (weight, not shake)
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const t = performance.now() / 1000;
    this.camera.position.x = Math.sin(t * (4 + hSpeed)) * 0.018 * Math.min(1, hSpeed / 4);
  }
}
