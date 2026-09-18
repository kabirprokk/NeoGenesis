// cannon-es integration bridge.
// Provides a thin wrapper around cannon-es physics world that can
// coexist with the custom EngineWorld. Use for scenarios that need
// more advanced physics (constraints, joints, complex shapes, etc.)
//
// The custom EngineWorld handles the core game simulation. This
// module provides optional cannon-es features as an augmentation.

import * as CANNON from "cannon-es";
import { PHYSICS } from "./constants.js";
import { type Body } from "./world.js";

/** Cannon-es world wrapper with enhanced configuration */
export class CannonWorld {
  world: CANNON.World | null = null;
  enabled: boolean = false;
  /** Map of custom body IDs to cannon bodies */
  bodyMap: Map<string, CANNON.Body> = new Map();
  /** Number of bodies in cannon-es */
  cannonBodyCount: number = 0;

  /** Initialize the cannon-es world with tuned parameters */
  init(config?: {
    gravity?: number;
    tolerance?: number;
    iterations?: number;
    allowSleep?: boolean;
  }): void {
    try {
      const gravity = config?.gravity ?? PHYSICS.G_EARTH;
      this.world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -gravity, 0),
        allowSleep: config?.allowSleep ?? true,
      });

      // Set default contact material
      const defaultMat = new CANNON.Material("default");
      const groundMat = new CANNON.Material("ground");
      const defaultContact = new CANNON.ContactMaterial(
        defaultMat,
        groundMat,
        {
          friction: 0.3,
          restitution: 0.15,
          contactEquationStiffness: 1e7,
          contactEquationRelaxation: 3,
          frictionEquationStiffness: 1e6,
          frictionEquationRelaxation: 3,
        }
      );
      this.world.addContactMaterial(defaultContact);

      // Configure broad-phase using SAP
      this.world.broadphase = new CANNON.SAPBroadphase(this.world);
      // World.solver is typed as base Solver; iterations lives on GSSolver.
      if (this.world.solver instanceof CANNON.GSSolver) {
        this.world.solver.iterations = config?.iterations ?? 10;
      }

      this.enabled = true;
      console.log("[CannonIntegration] cannon-es world initialized");
    } catch (e) {
      console.warn("[CannonIntegration] Failed to initialize cannon-es:", e);
      this.enabled = false;
    }
  }

  /** Create a cannon-es body from a custom body definition */
  createCannonBody(bodyDef: {
    id: string;
    shape: "sphere" | "box";
    radiusM?: number;
    halfM?: { x: number; y: number; z: number };
    pos: { x: number; y: number; z: number };
    vel?: { x: number; y: number; z: number };
    massKg: number;
    isStatic?: boolean;
    groupMask?: number;
    layerMask?: number;
  }): CANNON.Body | null {
    if (!this.world) return null;

    try {
      const shape = bodyDef.shape === "sphere"
        ? new CANNON.Sphere(Math.max(0.001, bodyDef.radiusM ?? 1))
        : new CANNON.Box(
            new CANNON.Vec3(
              Math.max(0.001, bodyDef.halfM?.x ?? 1),
              Math.max(0.001, bodyDef.halfM?.y ?? 1),
              Math.max(0.001, bodyDef.halfM?.z ?? 1)
            )
          );

      const mass = bodyDef.isStatic ? 0 : Math.max(0.001, bodyDef.massKg);
      const cannonBody = new CANNON.Body({
        mass,
        shape,
        position: new CANNON.Vec3(bodyDef.pos.x, bodyDef.pos.y, bodyDef.pos.z),
        velocity: bodyDef.vel
          ? new CANNON.Vec3(bodyDef.vel.x, bodyDef.vel.y, bodyDef.vel.z)
          : new CANNON.Vec3(0, 0, 0),
        type: bodyDef.isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
        collisionFilterGroup: bodyDef.groupMask ?? 1,
        collisionFilterMask: bodyDef.layerMask ?? -1,
      });

      this.world.addBody(cannonBody);
      this.bodyMap.set(bodyDef.id, cannonBody);
      this.cannonBodyCount = this.bodyMap.size;

      return cannonBody;
    } catch (e) {
      console.warn(`[CannonIntegration] Failed to create body ${bodyDef.id}:`, e);
      return null;
    }
  }

  /** Remove a cannon-es body */
  removeCannonBody(id: string): void {
    const body = this.bodyMap.get(id);
    if (body && this.world) {
      this.world.removeBody(body);
      this.bodyMap.delete(id);
      this.cannonBodyCount = this.bodyMap.size;
    }
  }

  /** Update cannon body position from custom body */
  syncBody(id: string, pos: { x: number; y: number; z: number }, vel?: { x: number; y: number; z: number }): void {
    const cannonBody = this.bodyMap.get(id);
    if (!cannonBody || !this.world) return;

    cannonBody.position.set(pos.x, pos.y, pos.z);
    if (vel) {
      cannonBody.velocity.set(vel.x, vel.y, vel.z);
    }
  }

  /** Step the cannon-es simulation */
  step(dt: number): void {
    if (!this.world) return;
    const maxSubsteps = 32;
    this.world.step(dt, dt, maxSubsteps);
  }

  /** Get collision events from cannon-es */
  getCollisionEvents(): Array<{
    bodyA: string;
    bodyB: string;
    impactVelocity: number;
    contactPoint: { x: number; y: number; z: number };
  }> {
    const events: Array<{
      bodyA: string;
      bodyB: string;
      impactVelocity: number;
      contactPoint: { x: number; y: number; z: number };
    }> = [];

    if (!this.world) return events;

    const contacts = this.world.contacts;
    for (const contact of contacts) {
      const bodyA = contact.bi;
      const bodyB = contact.bj;
      if (!bodyA || !bodyB) continue;

      const idA = this.findBodyId(bodyA);
      const idB = this.findBodyId(bodyB);
      const impactVel = this.getImpactVelocity(contact);

      if (impactVel > 0.5) {
        const cp = bodyA.position;
        events.push({
          bodyA: idA ?? "unknown",
          bodyB: idB ?? "unknown",
          impactVelocity: impactVel,
          contactPoint: { x: cp.x, y: cp.y, z: cp.z },
        });
      }
    }
    return events;
  }

  /** Get impact velocity from a contact */
  private getImpactVelocity(contact: { bi: CANNON.Body; bj: CANNON.Body; ni: CANNON.Vec3 }): number {
    try {
      const relVel = new CANNON.Vec3();
      (contact.bi as CANNON.Body).velocity.vsub((contact.bj as CANNON.Body).velocity, relVel);
      const contactNormal = contact.ni;
      return Math.abs(relVel.dot(contactNormal));
    } catch {
      return 0;
    }
  }

  /** Create a constraint (joint) between two bodies */
  createConstraint(
    bodyIdA: string,
    bodyIdB: string,
    type: "point" | "hinge" | "distance" | "lock",
    options?: {
      pivotA?: { x: number; y: number; z: number };
      pivotB?: { x: number; y: number; z: number };
      axis?: { x: number; y: number; z: number };
    }
  ): CANNON.Constraint | null {
    if (!this.world) return null;
    const bodyA = this.bodyMap.get(bodyIdA);
    const bodyB = this.bodyMap.get(bodyIdB);
    if (!bodyA || !bodyB) return null;

    try {
      let constraint: CANNON.Constraint | null = null;
      const pivotA = options?.pivotA ? new CANNON.Vec3(options.pivotA.x, options.pivotA.y, options.pivotA.z) : new CANNON.Vec3(0, 0, 0);
      const pivotB = options?.pivotB ? new CANNON.Vec3(options.pivotB.x, options.pivotB.y, options.pivotB.z) : new CANNON.Vec3(0, 0, 0);

      switch (type) {
        case "point": {
          constraint = new CANNON.PointToPointConstraint(bodyA, pivotA, bodyB, pivotB);
          break;
        }
        case "hinge": {
          const axis = options?.axis ? new CANNON.Vec3(options.axis.x, options.axis.y, options.axis.z) : new CANNON.Vec3(1, 0, 0);
          constraint = new CANNON.HingeConstraint(bodyA, bodyB, {
            pivotA,
            pivotB,
            axisA: axis,
          });
          break;
        }
        case "distance": {
          constraint = new CANNON.DistanceConstraint(bodyA, bodyB, 1.0);
          break;
        }
        case "lock": {
          constraint = new CANNON.LockConstraint(bodyA, bodyB);
          break;
        }
      }

      if (constraint) {
        this.world.addConstraint(constraint);
        return constraint;
      }
    } catch (e) {
      console.warn(`[CannonIntegration] Failed to create ${type} constraint:`, e);
    }
    return null;
  }

  /** Remove a constraint */
  removeConstraint(constraint: CANNON.Constraint): void {
    if (this.world) {
      this.world.removeConstraint(constraint);
    }
  }

  /** Apply an impulse to a body */
  applyImpulse(bodyId: string, impulse: { x: number; y: number; z: number }, point?: { x: number; y: number; z: number }): void {
    const cannonBody = this.bodyMap.get(bodyId);
    if (!cannonBody || !this.world) return;

    cannonBody.applyImpulse(
      new CANNON.Vec3(impulse.x, impulse.y, impulse.z),
      point ? new CANNON.Vec3(point.x, point.y, point.z) : cannonBody.position
    );
  }

  /** Apply a force to a body at a point */
  applyForce(bodyId: string, force: { x: number; y: number; z: number }, point?: { x: number; y: number; z: number }): void {
    const cannonBody = this.bodyMap.get(bodyId);
    if (!cannonBody || !this.world) return;

    cannonBody.applyForce(
      new CANNON.Vec3(force.x, force.y, force.z),
      point ? new CANNON.Vec3(point.x, point.y, point.z) : cannonBody.position
    );
  }

  /** Raycast against cannon-es bodies */
  raycast(origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, maxDist: number = 100): Array<{
    bodyId: string;
    hitPoint: { x: number; y: number; z: number };
    distance: number;
    normal: { x: number; y: number; z: number };
  }> {
    if (!this.world) return [];

    const results: Array<{
      bodyId: string;
      hitPoint: { x: number; y: number; z: number };
      distance: number;
      normal: { x: number; y: number; z: number };
    }> = [];

    try {
      // CANNON.Ray takes (from, to): bound the ray by maxDist since
      // RayOptions has no max-distance key — limiting lives in `to`.
      const len = Math.hypot(direction.x, direction.y, direction.z) || 1;
      const ray = new CANNON.Ray(
        new CANNON.Vec3(origin.x, origin.y, origin.z),
        new CANNON.Vec3(
          origin.x + (direction.x / len) * maxDist,
          origin.y + (direction.y / len) * maxDist,
          origin.z + (direction.z / len) * maxDist
        )
      );
      ray.skipBackfaces = true;

      const result = new CANNON.RaycastResult();
      ray.intersectWorld(this.world, {
        collisionFilterMask: -1,
        callback: (result: CANNON.RaycastResult) => {
          const bodyId = this.findBodyId(result.body as CANNON.Body) ?? "unknown";
          const hp = result.hitPointWorld ?? new CANNON.Vec3(0, 0, 0);
          const hn = result.hitNormalWorld ?? new CANNON.Vec3(0, 0, 0);
          results.push({
            bodyId,
            hitPoint: { x: hp.x, y: hp.y, z: hp.z },
            distance: result.distance ?? 0,
            normal: { x: hn.x, y: hn.y, z: hn.z },
          });
        },
        skipBackfaces: true,
      });
    } catch (e) {
      console.warn("[CannonIntegration] Raycast failed:", e);
    }
    return results;
  }

  /** Find the custom body ID for a cannon body */
  private findBodyId(cannonBody: CANNON.Body): string | null {
    for (const [id, body] of this.bodyMap) {
      if (body === cannonBody) return id;
    }
    return null;
  }

  /** Get the number of bodies */
  getBodyCount(): number {
    return this.bodyMap.size;
  }

  /** Shutdown the cannon-es world */
  shutdown(): void {
    if (this.world) {
      // cannon-es World has no clear(): remove bodies one by one.
      try {
        for (const b of this.bodyMap.values()) {
          try { this.world.removeBody(b); } catch { /* already gone */ }
        }
      } catch { /* keep shutting down */ }
      this.world = null;
    }
    this.bodyMap.clear();
    this.cannonBodyCount = 0;
    this.enabled = false;
  }
}

/** Factory to create cannon-es materials from NeoGenesis material definitions */
export function createCannonMaterial(materialId: string, friction: number, restitution: number): CANNON.Material {
  return new CANNON.Material(materialId);
}

/** Create a contact material pair for two bodies */
export function createContactMaterial(
  world: CANNON.World,
  materialA: CANNON.Material,
  materialB: CANNON.Material,
  options?: { friction?: number; restitution?: number }
): CANNON.ContactMaterial {
  const cm = new CANNON.ContactMaterial(materialA, materialB, {
    friction: options?.friction ?? 0.3,
    restitution: options?.restitution ?? 0.15,
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 3,
    frictionEquationStiffness: 1e6,
    frictionEquationRelaxation: 3,
  });
  world.addContactMaterial(cm);
  return cm;
}
