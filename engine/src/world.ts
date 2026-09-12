// EngineWorld — the plain plane world. Flat ground y=0, real gravity, real air,
// fixed 120 Hz timestep, deterministic. Bodies are rigid spheres/boxes with real
// material properties. This is what the AI "inhabits" during an experience.
import { PHYSICS } from "./constants.js";
import { MATERIALS, FLUIDS, DRAG_CD, type MaterialDef } from "./materials.js";
import { terminalVelocity } from "./physics.js";

export interface Vec3 { x: number; y: number; z: number }
export type Shape = "sphere" | "box";
/** A physical fluid volume (pool, tank, ocean section). Bodies inside get real
 * buoyancy + viscous damping; equilibrium floating emerges, nothing scripted. */
export interface FluidBox {
  name: string; min: Vec3; max: Vec3; density: number; viscosity: number;
}
export interface Body {
  id: string; shape: Shape; material: MaterialDef;
  radiusM: number; halfM?: Vec3; // sphere radius, or box half-extents
  pos: Vec3; vel: Vec3; massKg: number;
  tempC: number; broken: boolean; molten: boolean; burning: boolean;
  fluid: string | null; isStatic: boolean;
  dragProfile: string; dragCd: number; areaM2: number;
  events: string[];
}
export interface EnvPreset {
  gravity: number; airDensity: number; ambientC: number; groundMuS: number; groundMuK: number; name: string;
}
export const EARTH_SURFACE: EnvPreset = {
  name: "Earth surface", gravity: PHYSICS.G_EARTH, airDensity: PHYSICS.AIR_DENSITY,
  ambientC: 15, groundMuS: 0.8, groundMuK: 0.6,
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

  spawn(opts: {
    shape?: Shape; material?: string; sizeM?: number; pos?: Vec3; vel?: Vec3;
    tempC?: number; dragProfile?: string; massOverrideKg?: number; static?: boolean;
    scale?: Vec3; // non-uniform stretch (tank walls, beams) — volume/area scale along
  }): Body {
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
      dragProfile, dragCd: DRAG_CD[dragProfile] ?? DRAG_CD.cube, areaM2: area,
      events: [],
    };
    this.bodies.push(b);
    return b;
  }

  /** One fixed step. Returns event strings produced this step. */
  step(dt: number): string[] {
    const out: string[] = [];
    const air = FLUIDS.air;
    for (const b of this.bodies) {
      if (b.isStatic) continue; // tank walls, props — rendered, never integrated
      if (b.broken && b.molten) continue;
      // Gravity.
      b.vel.y -= this.env.gravity * dt;
      // Quadratic air drag, capped at terminal velocity (Table 18 behavior).
      const vt = terminalVelocity(b.massKg, b.dragCd, b.areaM2, this.env.airDensity);
      const sp = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
      if (sp > 1e-6) {
        const dragF = 0.5 * this.env.airDensity * sp * sp * b.dragCd * b.areaM2;
        const dv = (dragF / b.massKg) * dt;
        const k = Math.max(0, 1 - dv / sp);
        b.vel.x *= k; b.vel.y *= k; b.vel.z *= k;
        const sp2 = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
        if (sp2 > vt) { const s = vt / sp2; b.vel.x *= s; b.vel.y *= s; b.vel.z *= s; }
      }
      void air;
      // Fluids: submersion fraction → buoyancy counter-force + viscous damping.
      // Floating equilibrium falls out of the integration; nothing is scripted.
      const r0 = b.shape === "sphere" ? b.radiusM : b.halfM!.y;
      let sub = 0;
      let fl: FluidBox | null = null;
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
        b.vel.y += this.env.gravity * (fl.density / b.material.density) * sub * dt;
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
        const impactV = Math.abs(b.vel.y);
        if (impactV > 0.5) {
          const e = b.material.restitution;
          b.vel.y = impactV * e;
          // Horizontal friction bleed.
          const fr = Math.max(0, 1 - this.env.groundMuK * dt * 60 * 0.16);
          b.vel.x *= fr; b.vel.z *= fr;
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
      // Relax toward ambient (rate is qualitative — no specific-heat data claimed).
      b.tempC += (this.env.ambientC - b.tempC) * Math.min(1, dt * 0.05);
    }
    this.time += dt;
    return out;
  }

  /** Run seconds of sim at 120 Hz. Returns all events. */
  run(seconds: number): string[] {
    const all: string[] = [];
    const n = Math.ceil(seconds * 120);
    for (let i = 0; i < n; i++) all.push(...this.step(1 / 120));
    return all;
  }

  sample(): { t: number; bodies: { id: string; y: number; v: number; tempC: number; broken: boolean; molten: boolean; fluid: string | null }[]; fluids: { name: string; surfaceY: number }[] } {
    return {
      t: this.time,
      bodies: this.bodies.map((b) => ({
        id: b.id, y: b.pos.y, v: Math.hypot(b.vel.x, b.vel.y, b.vel.z),
        tempC: b.tempC, broken: b.broken, molten: b.molten, fluid: b.fluid,
      })),
      fluids: this.fluids.map((f) => ({ name: f.name, surfaceY: f.max.y })),
    };
  }
}
