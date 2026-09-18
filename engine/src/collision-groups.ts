// Collision groups and layers — bitmask-based filtering system.
// Each body belongs to one or more groups and can collide with
// specified layers. This replaces the brute-force O(n²) approach
// with selective collision checks.
//
// Bit layout: 32 groups, each body can be in multiple groups
// and check against multiple layers.

export type GroupId = number; // 0-31
export type LayerId = number; // 0-31
export type CollisionMask = number; // bitmask

// ─── Group definitions ────────────────────────────────────────────
export enum CollisionGroup {
  // Ground and static world geometry
  GROUND = 1 << 0,        // 1
  STRUCTURES = 1 << 1,    // 2 — walls, pillars, static props
  ENVIRONMENT = 1 << 2,   // 4 — terrain, atmospheric effects

  // Dynamic bodies
  DYNAMIC_SOLID = 1 << 3,  // 8 — rigid bodies (boxes, spheres)
  DYNAMIC_PROJECTILE = 1 << 4, // 16 — fast-moving objects (bullets, throws)
  DYNAMIC_FLUID = 1 << 5,  // 32 — fluid particles, droplets
  DYNAMIC_CARGO = 1 << 6,  // 64 — nested fluid cores (ghost bodies)

  // Special layers
  PLAYER = 1 << 7,       // 128 — player/controllable bodies
  ENEMY = 1 << 8,        // 256 — enemy/AI bodies
  COLLECTIBLE = 1 << 9,  // 512 — items, pickups
  VEHICLE = 1 << 10,     // 1024 — vehicles, containers

  // Effect bodies
  EFFECT_DEBRIS = 1 << 11,  // 2048 — shattered fragments
  EFFECT_SPLASH = 1 << 12,  // 4096 — splash/particle effects
  EFFECT_EXPLOSION = 1 << 13, // 8192 — explosion shockwaves

  // Sensor/triggers
  TRIGGER_ZONE = 1 << 14,   // 16384 — trigger volumes, sensors
  BOUNDARY = 1 << 15,       // 32768 — world boundaries, kill planes

  // Broad layer masks for common collision pairs
  // Ground collision: everything collides with ground and structures
  GROUND_LAYERS = GROUND | STRUCTURES | ENVIRONMENT,

  // Dynamic-solid collision: dynamic solids collide with each other,
  // ground, and structures but not with cargo/effects by default
  DYNAMIC_SOLID_LAYERS = GROUND | STRUCTURES | ENVIRONMENT | DYNAMIC_SOLID | PLAYER | VEHICLE,

  // Projectile collision: fast objects hit everything except other projectiles
  PROJECTILE_LAYERS = GROUND | STRUCTURES | ENVIRONMENT | DYNAMIC_SOLID | DYNAMIC_PROJECTILE | PLAYER | ENEMY | COLLECTIBLE | VEHICLE | EFFECT_DEBRIS | BOUNDARY,

  // Fluid collision: fluids interact with solids and other fluids
  FLUID_LAYERS = GROUND | STRUCTURES | ENVIRONMENT | DYNAMIC_SOLID | DYNAMIC_FLUID | DYNAMIC_CARGO | PLAYER | VEHICLE,

  // Cargo collision: ghost bodies only collide with their shell and ground
  CARGO_LAYERS = GROUND | STRUCTURES | DYNAMIC_SOLID | DYNAMIC_CARGO | PLAYER | VEHICLE,

  // Debris collision: fragments collide with ground and dynamic bodies
  DEBRIS_LAYERS = GROUND | STRUCTURES | DYNAMIC_SOLID | DYNAMIC_PROJECTILE | DYNAMIC_FLUID | EFFECT_DEBRIS | PLAYER,

  // Effect collision: effects collide with dynamic bodies and ground
  EFFECT_LAYERS = GROUND | STRUCTURES | DYNAMIC_SOLID | DYNAMIC_PROJECTILE | DYNAMIC_FLUID | DYNAMIC_CARGO | PLAYER | ENEMY | COLLECTIBLE,
}

// ─── Collision configuration for a body ────────────────────────────
export interface CollisionConfig {
  /** Bitmask of groups this body belongs to */
  groupMask: CollisionMask;
  /** Bitmask of layers this body checks collisions against */
  layerMask: CollisionMask;
  /** If true, body is a trigger (collides but no physical response) */
  isTrigger: boolean;
  /** Collision priority — higher priority bodies resist movement in overlapping cases */
  priority: number;
  /** If true, body never collides with other bodies (sensor only) */
  isSensor: boolean;
}

// ─── Default collision configs per body type ───────────────────────
export const COLLISION_CONFIGS: Record<string, CollisionConfig> = {
  ground: {
    groupMask: CollisionGroup.GROUND,
    layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS | CollisionGroup.PROJECTILE_LAYERS,
    isTrigger: false,
    priority: 0,
    isSensor: false,
  },
  structure: {
    groupMask: CollisionGroup.STRUCTURES,
    layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS | CollisionGroup.PROJECTILE_LAYERS,
    isTrigger: false,
    priority: 0,
    isSensor: false,
  },
  dynamicSolid: {
    groupMask: CollisionGroup.DYNAMIC_SOLID,
    layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS | CollisionGroup.PROJECTILE_LAYERS | CollisionGroup.EFFECT_LAYERS,
    isTrigger: false,
    priority: 1,
    isSensor: false,
  },
  projectile: {
    groupMask: CollisionGroup.DYNAMIC_PROJECTILE,
    layerMask: CollisionGroup.PROJECTILE_LAYERS,
    isTrigger: false,
    priority: 3,
    isSensor: false,
  },
  fluidParticle: {
    groupMask: CollisionGroup.DYNAMIC_FLUID,
    layerMask: CollisionGroup.FLUID_LAYERS,
    isTrigger: false,
    priority: 0,
    isSensor: false,
  },
  cargoCore: {
    groupMask: CollisionGroup.DYNAMIC_CARGO,
    layerMask: CollisionGroup.CARGO_LAYERS,
    isTrigger: true,
    priority: 0,
    isSensor: true,
  },
  player: {
    groupMask: CollisionGroup.PLAYER,
    layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS | CollisionGroup.PROJECTILE_LAYERS | CollisionGroup.COLLECTIBLE | CollisionGroup.ENEMY,
    isTrigger: false,
    priority: 2,
    isSensor: false,
  },
  enemy: {
    groupMask: CollisionGroup.ENEMY,
    layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS | CollisionGroup.PROJECTILE_LAYERS | CollisionGroup.PLAYER,
    isTrigger: false,
    priority: 2,
    isSensor: false,
  },
  collectible: {
    groupMask: CollisionGroup.COLLECTIBLE,
    layerMask: CollisionGroup.DYNAMIC_SOLID | CollisionGroup.DYNAMIC_PROJECTILE | CollisionGroup.PLAYER | CollisionGroup.CARGO_LAYERS,
    isTrigger: true,
    priority: 0,
    isSensor: true,
  },
  vehicle: {
    groupMask: CollisionGroup.VEHICLE,
    layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS | CollisionGroup.PROJECTILE_LAYERS | CollisionGroup.PLAYER,
    isTrigger: false,
    priority: 2,
    isSensor: false,
  },
  debris: {
    groupMask: CollisionGroup.EFFECT_DEBRIS,
    layerMask: CollisionGroup.DEBRIS_LAYERS,
    isTrigger: false,
    priority: 0,
    isSensor: false,
  },
  splash: {
    groupMask: CollisionGroup.EFFECT_SPLASH,
    layerMask: CollisionGroup.EFFECT_LAYERS,
    isTrigger: true,
    priority: 0,
    isSensor: true,
  },
  explosion: {
    groupMask: CollisionGroup.EFFECT_EXPLOSION,
    layerMask: CollisionGroup.EFFECT_LAYERS | CollisionGroup.DYNAMIC_SOLID_LAYERS,
    isTrigger: true,
    priority: 5,
    isSensor: true,
  },
  triggerZone: {
    groupMask: CollisionGroup.TRIGGER_ZONE,
    layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS | CollisionGroup.DYNAMIC_PROJECTILE | CollisionGroup.PLAYER | CollisionGroup.ENEMY | CollisionGroup.COLLECTIBLE,
    isTrigger: true,
    priority: 0,
    isSensor: true,
  },
  boundary: {
    groupMask: CollisionGroup.BOUNDARY,
    layerMask: CollisionGroup.DYNAMIC_SOLID | CollisionGroup.DYNAMIC_PROJECTILE | CollisionGroup.DYNAMIC_FLUID | CollisionGroup.PLAYER,
    isTrigger: false,
    priority: 0,
    isSensor: false,
  },
};

/** Check if two bodies should collide based on their collision groups and layers */
export function shouldCollide(a: CollisionConfig, b: CollisionConfig): boolean {
  // Triggers only generate events, never physical collision
  if (a.isTrigger && b.isTrigger) return false;
  if (a.isSensor || b.isSensor) return true; // Sensor generates events but no force

  // Check if a's groups overlap with b's layers or vice versa
  const aGroupsMatchB = (a.groupMask & b.layerMask) !== 0;
  const bGroupsMatchA = (b.groupMask & a.layerMask) !== 0;

  return aGroupsMatchB || bGroupsMatchA;
}

/** Get the collision group name from a bitmask */
export function groupName(mask: CollisionMask): string {
  const names: string[] = [];
  const entries: [CollisionGroup, string][] = [
    [CollisionGroup.GROUND, "GROUND"],
    [CollisionGroup.STRUCTURES, "STRUCTURES"],
    [CollisionGroup.ENVIRONMENT, "ENVIRONMENT"],
    [CollisionGroup.DYNAMIC_SOLID, "DYNAMIC_SOLID"],
    [CollisionGroup.DYNAMIC_PROJECTILE, "DYNAMIC_PROJECTILE"],
    [CollisionGroup.DYNAMIC_FLUID, "DYNAMIC_FLUID"],
    [CollisionGroup.DYNAMIC_CARGO, "DYNAMIC_CARGO"],
    [CollisionGroup.PLAYER, "PLAYER"],
    [CollisionGroup.ENEMY, "ENEMY"],
    [CollisionGroup.COLLECTIBLE, "COLLECTIBLE"],
    [CollisionGroup.VEHICLE, "VEHICLE"],
    [CollisionGroup.EFFECT_DEBRIS, "EFFECT_DEBRIS"],
    [CollisionGroup.EFFECT_SPLASH, "EFFECT_SPLASH"],
    [CollisionGroup.EFFECT_EXPLOSION, "EFFECT_EXPLOSION"],
    [CollisionGroup.TRIGGER_ZONE, "TRIGGER_ZONE"],
    [CollisionGroup.BOUNDARY, "BOUNDARY"],
  ];
  for (const [bit, name] of entries) {
    if (mask & bit) names.push(name);
  }
  return names.length ? names.join("|") : "NONE";
}

// Additional layer constants used in configs
export const PLAYER_LAYERS = CollisionGroup.PLAYER;
export const ENEMY_LAYERS = CollisionGroup.ENEMY;
export const COLLECTIBLE_LAYERS = CollisionGroup.COLLECTIBLE;
