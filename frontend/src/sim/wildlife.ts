// LOCAL wildlife agents near player (regional/global cohorts live in shared + backend).
import { SPECIES, type SpeciesDef } from "../../../shared/src/ecology.js";

export interface Agent { id: number; def: SpeciesDef; x: number; z: number; heading: number; speed: number; hunger01: number; fear01: number; state: string }
let nextId = 1;

export class LocalWildlife {
  agents: Agent[] = [];
  constructor(n = 7) {
    const herd = SPECIES.filter((s) => s.sociality === "herd");
    for (let i = 0; i < n; i++) {
      const def = herd[i % herd.length];
      this.agents.push({ id: nextId++, def, x: (Math.random() - 0.5) * 300, z: (Math.random() - 0.5) * 300,
        heading: Math.random() * Math.PI * 2, speed: def.speedMs * 0.15, hunger01: Math.random() * 0.5, fear01: 0, state: "graze" });
    }
    const pred = SPECIES.find((s) => s.id === "tyrannosaur-like")!;
    this.agents.push({ id: nextId++, def: pred, x: 250, z: -200, heading: 0, speed: 1, hunger01: 0.6, fear01: 0, state: "patrol" });
  }
  tick(dt: number, playerX: number, playerZ: number) {
    for (const a of this.agents) {
      const dx = a.x - playerX, dz = a.z - playerZ;
      const dist = Math.hypot(dx, dz);
      if (dist < a.def.fearRadiusM && a.def.diet === "herbivore") {
        a.state = "flee"; a.fear01 = Math.min(1, a.fear01 + dt);
        a.heading = Math.atan2(dx, dz);
        a.speed = a.def.speedMs * 0.8;
      } else if (a.def.diet === "predator" && dist < 40) {
        // State-dependent: warn, don't auto-aggro. Hungry + close = approach; else patrol.
        a.state = a.hunger01 > 0.7 ? "stalk" : "watch";
        a.heading = Math.atan2(playerX - a.x, playerZ - a.z);
        a.speed = a.state === "stalk" ? a.def.speedMs * 0.5 : 0.5;
      } else {
        if (a.state === "flee" && dist > a.def.fearRadiusM * 2) { a.state = "graze"; a.fear01 = 0; }
        if (a.state === "graze" || a.state === "patrol") {
          a.heading += (Math.random() - 0.5) * dt * 0.8;
          a.speed = a.def.speedMs * 0.12;
        }
      }
      a.x += Math.sin(a.heading) * a.speed * dt;
      a.z += Math.cos(a.heading) * a.speed * dt;
      a.hunger01 = Math.min(1, a.hunger01 + dt * 0.002);
    }
  }
}
