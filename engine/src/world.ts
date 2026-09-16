// EngineWorld — the plain plane world. Flat ground y=0, real gravity, real air,
// fixed 120 Hz timestep, deterministic. Bodies are rigid spheres/boxes with real
// material properties. This is what the AI "inhabits" during an experience.
import { PHYSICS } from "./constants.js";
import { MATERIALS, DRAG_CD, type MaterialDef } from "./materials.js";
import { SPECIFIC_HEAT, EMISSIVITY, H_CONV, altitudeDensity } from "./science.js";
import { machCdFactor, magnusCl } from "./physics.js";

export interface Vec3 { x: number; y: number; z: number }
export type Shape = "sphere" | "box";
/** A physical fluid volume (pool, tank, ocean section). Bodies inside get real
 * buoyancy + viscous damping; equilibrium floating emerges, nothing scripted. */
export interface FluidBox {
  name: string; min: Vec3; max: Vec3; density: number; viscosity: number;
  /** Pinned temperature (°C). Undefined = ambient, so pools track weather. */
  tempC?: number;
}
export interface Body {
  id: string; shape: Shape; material: MaterialDef;
  radiusM: number; halfM?: Vec3; // sphere radius, or box half-extents
  pos: Vec3; vel: Vec3; massKg: number;
  tempC: number; broken: boolean; molten: boolean; burning: boolean;
  fluid: string | null; isStatic: boolean;
  hasMoved: boolean; settled: boolean; // rest-event bookkeeping (one "came to rest" per body)
  hitT: number; // last body-on-body impact time (narration cooldown)
  ghost: boolean; // nested cargo (fluid cores): skips body-vs-body contact, still hits ground
  spin: Vec3; // angular velocity rad/s — Magnus lift + visual tumble + rolling
  rot: Vec3; // euler orientation, integrated from spin every substep
  sloshM: number; // cargo offset from its shell anchor (0 for shells) — weight-shift readout
  landedT: number | null; // first touchdown time (ground or fluid surface) for landing-order races
  dragProfile: string; dragCd: number; areaM2: number;
  events: string[];
}
export interface EnvPreset {
  gravity: number; airDensity: number; ambientC: number; groundMuS: number; groundMuK: number; name: string;
  wind: Vec3; // bulk air motion m/s — drag + terminal velocity use air-relative velocity
}
/** Ground bounce partner: poured-concrete-ish slab, gameplay-tuned (pair property). */
export const GROUND_E = 0.15;
/** Body budget: collidePairs is O(n²) and shadows cost per mesh — past this
 * the game would slide-show. Spawn refuses loudly instead of lagging silently. */
export const MAX_BODIES = 500;
/** Slosh tether: ghost fluid core ↔ shell. Approx pendulum model, NOT CFD —
 * stiffness/damping widen with empty headspace (half-full sloshes hardest). */
export interface SloshTether { cargo: string; shell: string; k: number; damp: number; fill: number }
export const EARTH_SURFACE: EnvPreset = {
  name: "Earth surface", gravity: PHYSICS.G_EARTH, airDensity: PHYSICS.AIR_DENSITY,
  ambientC: 15, groundMuS: 0.8, groundMuK: 0.6, wind: { x: 0, y: 0, z: 0 },
};

let nextId = 1;
export class EngineWorld {
  env: EnvPreset = { ...EARTH_SURFACE };
  bodies: Body[] = [];
  fluids: FluidBox[] = [];
  time = 0;
  log: string[] = [];

  addFluid(f: FluidBox): number { this.fluids.push(f); return this.fluids.length - 1; }
  clearFluids(): void { this.fluids = []; }
  tethers: SloshTether[] = [];

  /** Tie a ghost cargo core to its shell (spring-damper in both directions). */
  tether(cargoId: string, shellId: string, fill: number): SloshTether {
    const headroom = 1 - Math.min(1, Math.max(0, fill));
    // Full = stiff plug (k=80), half = loose slosh (k≈18), near-empty = light rattle.
    const k = 80 - 62 * Math.sin(Math.PI * Math.min(1, Math.max(0, fill)));
    const t: SloshTether = { cargo: cargoId, shell: shellId, k, damp: 1.5 + 4 * headroom, fill };
    this.tethers.push(t);
    return t;
  }

  spawn(opts: {
    shape?: Shape; material?: string; sizeM?: number; pos?: Vec3; vel?: Vec3;
    tempC?: number; dragProfile?: string; massOverrideKg?: number; static?: boolean;
    ghost?: boolean; spin?: Vec3; cargoOfId?: string; fillFrac?: number;
    scale?: Vec3; // non-uniform stretch (tank walls, beams) — volume/area scale along
  }): Body {
    if (this.bodies.length >= MAX_BODIES) {
      throw new Error(`body budget exceeded (${MAX_BODIES}) — remove something first (reset clears all)`);
    }
    const mat = MATERIALS[opts.material ?? "oak"];
    const shape = opts.shape ?? "box";
    const sizeM = opts.sizeM ?? 1;
    const sc = opts.scale ?? { x: 1, y: 1, z: 1 };
    const volume = (shape === "sphere" ? (4 / 3) * Math.PI * sizeM ** 3 : (2 * sizeM) ** 3) * sc.x * sc.y * sc.z;
    const area = (shape === "sphere" ? Math.PI * sizeM ** 2 : (2 * sizeM) ** 2) * sc.x * sc.y;
    const dragProfile = opts.dragProfile ?? (shape === "sphere" ? "sphere" : "cube");
    const b: Body = {
      id: `b${nextId++}`, shape, material: mat, radiusM: sizeM,
      halfM: shape === "box" ? { x: sizeM * sc.x, y: sizeM * sc.y, z: sizeM * sc.z } : undefined,
      pos: opts.pos ?? { x: 0, y: 10, z: 0 }, vel: opts.vel ?? { x: 0, y: 0, z: 0 },
      massKg: opts.massOverrideKg ?? mat.density * volume,
      tempC: opts.tempC ?? this.env.ambientC,
      broken: false, molten: false, burning: false,
      fluid: null, isStatic: opts.static ?? false,
      hasMoved: false, settled: false, hitT: -10, ghost: opts.ghost ?? false,
      spin: opts.spin ?? { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 }, sloshM: 0, landedT: null,
      dragProfile, dragCd: DRAG_CD[dragProfile] ?? DRAG_CD.cube, areaM2: area,
      events: [],
    };
    this.bodies.push(b);
    if (opts.cargoOfId) this.tether(b.id, opts.cargoOfId, opts.fillFrac ?? 1);
    return b;
  }

  /** One fixed step. Returns event strings produced this step.
   * CCD-lite: fast steps subdivide so no body moves more than half its
   * smallest extent per sub-integration (tunneling guard, ≤32 substeps). */
  step(dt: number): string[] {
    const out: string[] = [];
    let nSub = 1;
    for (const b of this.bodies) {
      if (b.isStatic || (b.broken && b.molten)) continue;
      const sp = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
      const char = b.shape === "sphere" ? b.radiusM : Math.min(b.halfM!.x, b.halfM!.y, b.halfM!.z);
      if (char > 1e-6 && sp * dt > char * 0.5) {
        nSub = Math.max(nSub, Math.min(32, Math.ceil((sp * dt) / (char * 0.5))));
      }
    }
    const sdt = dt / nSub;
    for (let k = 0; k < nSub; k++) {
      this.tetherPass(sdt);
      this.integrate(sdt, out);
      this.collidePairs(out);
      this.time += sdt;
    }
    return out;
  }

  /** Slosh pass: ghost cargo cores pull on their shells through a
   * spring-damper (approx pendulum model, momentum-conserving, Euler-clamped). */
  private tetherPass(dt: number): void {
    for (const t of this.tethers) {
      const c = this.bodies.find((b) => b.id === t.cargo);
      const s = this.bodies.find((b) => b.id === t.shell);
      if (!c || !s || c.isStatic) continue;
      const dx = c.pos.x - s.pos.x, dy = c.pos.y - s.pos.y, dz = c.pos.z - s.pos.z;
      const dvx = c.vel.x - s.vel.x, dvy = c.vel.y - s.vel.y, dvz = c.vel.z - s.vel.z;
      c.sloshM = Math.hypot(dx, dy, dz);
      const mMin = Math.max(1e-3, Math.min(c.massKg, s.isStatic ? Infinity : s.massKg));
      const ke = Math.min(t.k, (0.25 * mMin) / (dt * dt));
      const fx = -ke * dx - t.damp * dvx;
      const fy = -ke * dy - t.damp * dvy;
      const fz = -ke * dz - t.damp * dvz;
      c.vel.x += (fx / c.massKg) * dt; c.vel.y += (fy / c.massKg) * dt; c.vel.z += (fz / c.massKg) * dt;
      if (!s.isStatic) {
        s.vel.x -= (fx / s.massKg) * dt; s.vel.y -= (fy / s.massKg) * dt; s.vel.z -= (fz / s.massKg) * dt;
      }
    }
  }

  /** One physics integration pass (no pair contact, no clock — step() drives). */
  private integrate(dt: number, out: string[]): void {
    for (const b of this.bodies) {
      if (b.isStatic) continue; // tank walls, props — rendered, never integrated
      if (b.broken && b.molten) continue;
      // NaN guard: poisoned state (bad spawn args, runaway math) can never
      // propagate — freeze the body, say so once, keep simulating.
      if (!Number.isFinite(b.pos.x + b.pos.y + b.pos.z + b.vel.x + b.vel.y + b.vel.z)) {
        b.vel.x = 0; b.vel.y = 0; b.vel.z = 0;
        b.pos.y = Math.max(b.pos.y === b.pos.y ? b.pos.y : 10, b.shape === "sphere" ? b.radiusM : b.halfM!.y);
        b.pos.x = b.pos.x === b.pos.x ? b.pos.x : 0;
        b.pos.z = b.pos.z === b.pos.z ? b.pos.z : 0;
        const ev = `${b.id} state reset — non-finite input rejected.`;
        b.events.push(ev); out.push(ev); this.log.push(ev);
        continue;
      }
      // Altitude-coupled air and gravity (real formulas, zero tuning):
      // g(h) = g0·(R/(R+h))² and ISA/US-76 density. Sea level reproduces the
      // old constants exactly; high drops fly thinner, faster air. Presets
      // (vacuum, Mars) scale relatively — a zero stays zero.
      const altM = Math.max(0, b.pos.y);
      const g = this.env.gravity * (6371000 / (6371000 + altM)) ** 2;
      const rho = this.env.airDensity < 1e-9 ? 0 : this.env.airDensity * (altitudeDensity(altM) / 1.225);
      // Gravity.
      b.vel.y -= g * dt;
      // Quadratic air drag on AIR-RELATIVE velocity (wind counts). Cd rises
      // through the transonic bump (approx). No terminal-velocity clamp:
      // vt is the equilibrium fall speed, not a speed limit — supersonic
      // launches must decelerate through drag, not teleport down to vt.
      const rvx = b.vel.x - this.env.wind.x, rvy = b.vel.y - this.env.wind.y, rvz = b.vel.z - this.env.wind.z;
      const rsp = Math.hypot(rvx, rvy, rvz);
      const sp = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
      if (sp > 1.5) b.hasMoved = true;
      if (rsp > 1e-6) {
        const cdEff = b.dragCd * machCdFactor(rsp, this.env.ambientC);
        const dragF = 0.5 * rho * rsp * rsp * cdEff * b.areaM2;
        const dv = (dragF / b.massKg) * dt;
        const k = Math.max(0, 1 - dv / rsp);
        b.vel.x = this.env.wind.x + rvx * k;
        b.vel.y = this.env.wind.y + rvy * k;
        b.vel.z = this.env.wind.z + rvz * k;
        // Magnus lift for spinning bodies (approx curveball model, spheres mostly).
        const spinMag = Math.hypot(b.spin.x, b.spin.y, b.spin.z);
        if (spinMag > 1e-3 && rsp > 0.5) {
          const r0 = b.shape === "sphere" ? b.radiusM : b.halfM!.y;
          const cl = magnusCl(spinMag, r0, rsp);
          // F = ½·ρ·v²·A·Cl along normalize(spin × vrel).
          const cx = b.spin.y * rvz - b.spin.z * rvy;
          const cy = b.spin.z * rvx - b.spin.x * rvz;
          const cz = b.spin.x * rvy - b.spin.y * rvx;
          const cm = Math.hypot(cx, cy, cz);
          if (cm > 1e-9) {
            const f = 0.5 * rho * rsp * rsp * b.areaM2 * cl / cm;
            b.vel.x += (f * cx / b.massKg) * dt;
            b.vel.y += (f * cy / b.massKg) * dt;
            b.vel.z += (f * cz / b.massKg) * dt;
          }
        }
      }
      // Orientation integrates every substep — spin IS angular velocity.
      // Airborne spin persists with weak angular drag (approx, no inertia
      // tensor); ground contact rolls and impacts tumble (below). Collision
      // stays AABB: the tumble is visual kinematics, documented.
      const angDrag = Math.exp(-0.08 * dt);
      b.spin.x *= angDrag; b.spin.y *= angDrag; b.spin.z *= angDrag;
      b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt; b.rot.z += b.spin.z * dt;
      // Fluids: submersion fraction → buoyancy counter-force + viscous damping.
      // Floating equilibrium falls out of the integration; nothing is scripted.
      const r0 = b.shape === "sphere" ? b.radiusM : b.halfM!.y;
      let sub = 0;
      let fl: FluidBox | null = null;
      let subTemp: number | null = null;
      for (const f of this.fluids) {
        if (b.pos.x > f.min.x && b.pos.x < f.max.x && b.pos.z > f.min.z && b.pos.z < f.max.z) {
          const s = Math.min(1, Math.max(0, (f.max.y - (b.pos.y - r0)) / (2 * r0)));
          if (s > 0) { sub = s; fl = f; break; }
        }
      }
      if (fl && sub > 0) {
        const speed = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
        if (!b.fluid && speed > 1.5) {
          const ev = `${b.id} SPLASHED into ${fl.name} at ${speed.toFixed(1)} m/s.`;
          b.events.push(ev); out.push(ev); this.log.push(ev);
        }
        b.fluid = fl.name;
        subTemp = fl.tempC ?? this.env.ambientC;
        b.vel.y += g * (fl.density / b.material.density) * sub * dt;
        const k = Math.exp(-sub * (1.5 + Math.min(8, fl.viscosity * 6)) * dt);
        b.vel.x *= k; b.vel.y *= k; b.vel.z *= k;
      } else {
        b.fluid = null;
      }
      b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt; b.pos.z += b.vel.z * dt;
      // Ground plane y=0: bounce + Coulomb friction.
      const r = b.shape === "sphere" ? b.radiusM : b.halfM!.y;
      if (b.pos.y <= r) {
        b.pos.y = r;
        if (b.landedT === null && b.hasMoved) b.landedT = this.time;
        const impactV = Math.abs(b.vel.y);
        if (impactV > 0.5) {
          // Pair-averaged restitution: body vs poured-concrete-ish ground
          // (GROUND_E, gameplay-tuned) — same pair rule as body-vs-body.
          const e = (b.material.restitution + GROUND_E) / 2;
          b.vel.y = impactV * e;
          // Horizontal friction bleed.
          const fr = Math.max(0, 1 - this.env.groundMuK * dt * 60 * 0.16);
          b.vel.x *= fr; b.vel.z *= fr;
          // Impact tumble: horizontal motion converts to spin, deterministically
          // and proportionally — real impacts trade translation for rotation.
          b.spin.x += (b.vel.z * 0.2) / r;
          b.spin.z += (-b.vel.x * 0.2) / r;
          // Structural verdict on hard hits. Brittle materials fail from point
          // loading (stress concentration over ~0.7% of face); ductile ones
          // spread the load over ~10%. Conservative for small glass — documented.
          const brittle = ["glass", "concrete", "ice"].includes(b.material.id);
          const spread = !brittle ? 0.1 : b.shape === "sphere" ? 0.002 : 0.007;
          const area = b.shape === "sphere" ? Math.PI * r * r * spread : (2 * r) * (2 * r) * spread;
          const ke = 0.5 * b.massKg * impactV * impactV;
          const pMpa = ke / Math.max(1e-6, area) / 1e6;
          const ult = b.material.ultimateMpa ?? b.material.tensileMpa ?? Infinity;
          if (pMpa > ult) {
            b.broken = true;
            const ev = `${b.id} (${b.material.name}) SHATTERED on impact at ${impactV.toFixed(1)} m/s — ${pMpa.toFixed(0)} MPa > ${ult} MPa ultimate.`;
            b.events.push(ev); out.push(ev); this.log.push(ev);
          } else if (impactV > 3) {
            const limit = ult === Infinity ? "no break data" : `${ult} MPa`;
            const ev = `${b.id} impacted at ${impactV.toFixed(1)} m/s, held (${pMpa.toFixed(1)} MPa vs ${limit}).`;
            b.events.push(ev); out.push(ev);
          }
          if (b.vel.y < 0.4) b.vel.y = 0;
        } else {
          b.vel.y = 0;
          // Resting contact friction kills slide.
          const fr = Math.max(0, 1 - this.env.groundMuS * dt * 8);
          b.vel.x *= fr; b.vel.z *= fr;
          // Rolling without slipping: relax spin toward ω = n̂ × v / r.
          const kRoll = Math.min(1, 8 * dt);
          b.spin.x += ((b.vel.z / r) - b.spin.x) * kRoll;
          b.spin.z += ((-b.vel.x / r) - b.spin.z) * kRoll;
          // Sleep: true rest is exact zero — kills slide/spin jitter nonsense.
          if (Math.hypot(b.vel.x, b.vel.z) < 0.15) {
            b.vel.x = 0; b.vel.z = 0;
            b.spin.x = 0; b.spin.y = 0; b.spin.z = 0;
          }
          // One rest note per body, so slides/rolls/crushes narrate their ending.
          if (b.hasMoved && !b.settled && Math.hypot(b.vel.x, b.vel.z) < 0.4) {
            b.settled = true;
            const ev = `${b.id} (${b.material.name}) came to rest.`;
            b.events.push(ev); this.log.push(ev);
          }
        }
      }
      // Thermal state vs ambient + own thresholds.
      const m = b.material;
      if (m.meltC !== undefined && b.tempC >= m.meltC && !b.molten) {
        b.molten = true;
        const ev = `${b.id} (${m.name}) MELTED at ${b.tempC}°C (melts ${m.meltC}°C).`;
        b.events.push(ev); out.push(ev); this.log.push(ev);
      }
      if (m.ignitionC !== undefined && b.tempC >= m.ignitionC && !b.burning) {
        b.burning = true;
        const ev = `${b.id} (${m.name}) IGNITED at ${b.tempC}°C (ignites ${m.ignitionC}°C).`;
        b.events.push(ev); out.push(ev); this.log.push(ev);
      }
      // Real heat transfer: convection in the surrounding medium (still air 10,
      // water 800, lava 500 W/m²·K) + Stefan-Boltzmann radiation with the
      // material's emissivity. dT/dt = (h·A·ΔT + ε·σ·A·ΔT⁴) / (m·c).
      const c = SPECIFIC_HEAT[m.id]?.c ?? 1000;
      const surf = b.areaM2 * (b.shape === "sphere" ? 4 : 6);
      const h = b.fluid
        ? (b.fluid.toLowerCase().includes("lava") ? H_CONV.lavaBath.h : H_CONV.waterBath.h)
        : H_CONV.stillAir.h;
      const em = EMISSIVITY[m.id]?.e ?? 0.9;
      // A submerged body equilibrates toward the FLUID (lava cooks, water cools),
      // otherwise toward ambient air.
      const Tamb = subTemp ?? this.env.ambientC;
      const k4 = (t: number): number => { const K = t + 273.15; return K * K * K * K; };
      const dConv = (h * surf * (Tamb - b.tempC)) / (b.massKg * c);
      const dRad = (em * PHYSICS.STEFAN_BOLTZMANN * surf * (k4(Tamb) - k4(b.tempC))) / (b.massKg * c);
      b.tempC += (dConv + dRad) * dt;
    }
  }

  /** Body-vs-body contact: sphere/sphere, box/box (AABB, no rotation in this
   *  engine), sphere/box via closest point. Statics have infinite mass, so
   *  tank walls now contain bodies. Impulse uses pair-averaged restitution;
   *  hard hits fracture against each body's own ultimate strength. */
  private collidePairs(out: string[]): void {
    const bs = this.bodies;
    const extents = (b: Body): Vec3 => b.shape === "sphere"
      ? { x: b.radiusM, y: b.radiusM, z: b.radiusM }
      : { x: b.halfM!.x, y: b.halfM!.y, z: b.halfM!.z };
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], c = bs[j];
        if (a.isStatic && c.isStatic) continue;
        if (a.ghost || c.ghost) continue; // nested cargo flies with its shell
        const ea = extents(a), ec = extents(c);
        let nx = 0, ny = 0, nz = 0, overlap = 0;
        if (a.shape === "sphere" && c.shape === "sphere") {
          const dx = c.pos.x - a.pos.x, dy = c.pos.y - a.pos.y, dz = c.pos.z - a.pos.z;
          const d = Math.hypot(dx, dy, dz);
          const rr = a.radiusM + c.radiusM;
          if (d >= rr) continue;
          if (d > 1e-9) { nx = dx / d; ny = dy / d; nz = dz / d; } else { ny = 1; }
          overlap = rr - d;
        } else if (a.shape === "box" && c.shape === "box") {
          const dx = c.pos.x - a.pos.x, dy = c.pos.y - a.pos.y, dz = c.pos.z - a.pos.z;
          const ox = ea.x + ec.x - Math.abs(dx), oy = ea.y + ec.y - Math.abs(dy), oz = ea.z + ec.z - Math.abs(dz);
          if (ox <= 0 || oy <= 0 || oz <= 0) continue;
          if (ox <= oy && ox <= oz) { nx = dx >= 0 ? 1 : -1; overlap = ox; }
          else if (oy <= oz) { ny = dy >= 0 ? 1 : -1; overlap = oy; }
          else { nz = dz >= 0 ? 1 : -1; overlap = oz; }
        } else {
          // Sphere vs box: closest point on the box to the sphere center.
          const s = a.shape === "sphere" ? a : c;
          const box = a.shape === "box" ? a : c;
          const eb = extents(box);
          const qx = Math.max(box.pos.x - eb.x, Math.min(s.pos.x, box.pos.x + eb.x));
          const qy = Math.max(box.pos.y - eb.y, Math.min(s.pos.y, box.pos.y + eb.y));
          const qz = Math.max(box.pos.z - eb.z, Math.min(s.pos.z, box.pos.z + eb.z));
          const dx = s.pos.x - qx, dy = s.pos.y - qy, dz = s.pos.z - qz;
          const d = Math.hypot(dx, dy, dz);
          if (d >= s.radiusM) continue; // separated
          let fx = 0, fy = 0, fz = 0, ov = 0;
          if (d > 1e-9) { fx = dx / d; fy = dy / d; fz = dz / d; ov = s.radiusM - d; }
          else {
            // Center inside (or on) the box: eject along min-penetration axis.
            const px = eb.x - Math.abs(s.pos.x - box.pos.x);
            const py = eb.y - Math.abs(s.pos.y - box.pos.y);
            const pz = eb.z - Math.abs(s.pos.z - box.pos.z);
            if (px <= py && px <= pz) { fx = s.pos.x >= box.pos.x ? 1 : -1; ov = px + s.radiusM; }
            else if (py <= pz) { fy = s.pos.y >= box.pos.y ? 1 : -1; ov = py + s.radiusM; }
            else { fz = s.pos.z >= box.pos.z ? 1 : -1; ov = pz + s.radiusM; }
          }
          // Contact normal must point from a to c: f runs box→sphere.
          if (s === a) { fx = -fx; fy = -fy; fz = -fz; }
          nx = fx; ny = fy; nz = fz; overlap = ov;
        }
        if (overlap <= 0) continue;
        // Mass-split positional correction (statics don't move).
        const ima = a.isStatic ? 0 : 1 / a.massKg;
        const imc = c.isStatic ? 0 : 1 / c.massKg;
        const imSum = ima + imc;
        if (imSum <= 0) continue;
        const corr = overlap / imSum;
        a.pos.x -= nx * corr * ima; a.pos.y -= ny * corr * ima; a.pos.z -= nz * corr * ima;
        c.pos.x += nx * corr * imc; c.pos.y += ny * corr * imc; c.pos.z += nz * corr * imc;
        // Impulse along the contact normal.
        const vn = (c.vel.x - a.vel.x) * nx + (c.vel.y - a.vel.y) * ny + (c.vel.z - a.vel.z) * nz;
        if (vn < 0) {
          const e = (a.material.restitution + c.material.restitution) / 2;
          const jimp = (-(1 + e) * vn) / imSum;
          a.vel.x -= nx * jimp * ima; a.vel.y -= ny * jimp * ima; a.vel.z -= nz * jimp * ima;
          c.vel.x += nx * jimp * imc; c.vel.y += ny * jimp * imc; c.vel.z += nz * jimp * imc;
          // Resting-contact friction: bleed tangential slide on hard contact.
          const fr = Math.max(0, 1 - 0.2 * (1 / 120) * 60);
          a.vel.x *= 1 - (1 - fr) * (ima / imSum); a.vel.z *= 1 - (1 - fr) * (ima / imSum);
          c.vel.x *= 1 - (1 - fr) * (imc / imSum); c.vel.z *= 1 - (1 - fr) * (imc / imSum);
          const speed = -vn;
          if (speed > 1.5 && this.time - Math.max(a.hitT, c.hitT) > 0.5) {
            a.hitT = this.time; c.hitT = this.time;
            const ev = `${a.id} (${a.material.name}) collided with ${c.id} (${c.material.name}) at ${speed.toFixed(1)} m/s.`;
            a.events.push(ev); c.events.push(ev); out.push(ev); this.log.push(ev);
          }
          // Fracture: reduced-mass energy vs each body's own ultimate.
          const mu = ima + imc > 0 ? 1 / imSum : 0;
          for (const bd of [a, c]) {
            if (bd.isStatic || bd.broken) continue;
            const brittle = ["glass", "concrete", "ice"].includes(bd.material.id);
            const spread = !brittle ? 0.1 : bd.shape === "sphere" ? 0.002 : 0.007;
            const r0 = bd.shape === "sphere" ? bd.radiusM : bd.halfM!.y;
            const area = bd.shape === "sphere" ? Math.PI * r0 * r0 * spread : (2 * r0) * (2 * r0) * spread;
            const ke = 0.5 * mu * speed * speed;
            const pMpa = ke / Math.max(1e-6, area) / 1e6;
            const ult = bd.material.ultimateMpa ?? bd.material.tensileMpa ?? Infinity;
            if (pMpa > ult) {
              bd.broken = true;
              const bev = `${bd.id} (${bd.material.name}) SHATTERED in collision at ${speed.toFixed(1)} m/s — ${pMpa.toFixed(0)} MPa > ${ult} MPa ultimate.`;
              bd.events.push(bev); out.push(bev); this.log.push(bev);
            }
          }
        }
      }
    }
  }

  /** Run seconds of sim at 120 Hz. Returns all events. */
  run(seconds: number): string[] {
    const all: string[] = [];
    const n = Math.ceil(seconds * 120);
    for (let i = 0; i < n; i++) all.push(...this.step(1 / 120));
    return all;
  }

  sample(): { t: number; bodies: { id: string; y: number; v: number; tempC: number; broken: boolean; molten: boolean; fluid: string | null; landedT: number | null; sloshM: number }[]; fluids: { name: string; surfaceY: number }[] } {
    return {
      t: this.time,
      bodies: this.bodies.map((b) => ({
        id: b.id, y: b.pos.y, v: Math.hypot(b.vel.x, b.vel.y, b.vel.z),
        tempC: b.tempC, broken: b.broken, molten: b.molten, fluid: b.fluid,
        landedT: b.landedT, sloshM: +b.sloshM.toFixed(3),
      })),
      fluids: this.fluids.map((f) => ({ name: f.name, surfaceY: f.max.y })),
    };
  }
}
