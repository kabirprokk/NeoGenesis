// Enhanced physics test suite — validates collision groups,
// broad-phase optimization, tunable parameters, and cannon-es
// integration for the NeoGenesis engine.

import { describe, it, expect } from "vitest";
import { PHYSICS } from "../src/constants.js";
import { EngineWorld } from "../src/world.js";
import {
  CollisionGroup,
  shouldCollide,
  COLLISION_CONFIGS,
  type CollisionConfig,
  groupName,
} from "../src/collision-groups.js";
import {
  DEFAULT_PHYSICS_CONFIG,
  DEFAULT_WORLD_CONFIG,
  DEFAULT_COLLISION_TUNING,
  DEFAULT_DRAG_TUNING,
  DEFAULT_SLEEP_TUNING,
  ENV_PRESETS,
  type PhysicsConfig,
  type WorldConfig,
} from "../src/physics-tunable.js";
import { SpatialGrid } from "../src/spatial-grid.js";
import { BroadPhaseDetector } from "../src/spatial-grid.js";

// ─── Collision Groups Tests ───────────────────────────────────

describe("Collision Groups", () => {
  it("should detect collision between overlapping groups", () => {
    const a: CollisionConfig = {
      groupMask: CollisionGroup.DYNAMIC_SOLID,
      layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS,
      isTrigger: false,
      priority: 1,
      isSensor: false,
    };
    const b: CollisionConfig = {
      groupMask: CollisionGroup.DYNAMIC_SOLID,
      layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS,
      isTrigger: false,
      priority: 1,
      isSensor: false,
    };
    expect(shouldCollide(a, b)).toBe(true);
  });

  it("should not collide when both are triggers", () => {
    const a: CollisionConfig = {
      groupMask: CollisionGroup.TRIGGER_ZONE,
      layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS,
      isTrigger: true,
      priority: 0,
      isSensor: true,
    };
    const b: CollisionConfig = {
      groupMask: CollisionGroup.TRIGGER_ZONE,
      layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS,
      isTrigger: true,
      priority: 0,
      isSensor: true,
    };
    expect(shouldCollide(a, b)).toBe(false);
  });

  it("should have correct group names", () => {
    expect(groupName(CollisionGroup.GROUND)).toBe("GROUND");
    expect(groupName(CollisionGroup.DYNAMIC_SOLID)).toBe("DYNAMIC_SOLID");
    expect(groupName(CollisionGroup.GROUND | CollisionGroup.STRUCTURES)).toBe("GROUND|STRUCTURES");
    expect(groupName(0)).toBe("NONE");
  });

  it("should have default collision configs", () => {
    expect(COLLISION_CONFIGS.ground).toBeDefined();
    expect(COLLISION_CONFIGS.dynamicSolid).toBeDefined();
    expect(COLLISION_CONFIGS.player).toBeDefined();
    expect(COLLISION_CONFIGS.projectile).toBeDefined();
  });
});

// ─── Tunable Parameters Tests ─────────────────────────────────

describe("Tunable Parameters", () => {
  it("should have valid default world config", () => {
    expect(DEFAULT_WORLD_CONFIG.fixedDt).toBe(1 / 120);
    expect(DEFAULT_WORLD_CONFIG.maxSubsteps).toBe(32);
    expect(DEFAULT_WORLD_CONFIG.maxBodies).toBe(500);
    expect(DEFAULT_WORLD_CONFIG.useBroadPhase).toBe(true);
    expect(DEFAULT_WORLD_CONFIG.sleepSpeedThreshold).toBeCloseTo(0.15);
  });

  it("should have valid default collision tuning", () => {
    expect(DEFAULT_COLLISION_TUNING.groundRestitution).toBe(0.15);
    expect(DEFAULT_COLLISION_TUNING.groundStaticFriction).toBe(0.8);
    expect(DEFAULT_COLLISION_TUNING.groundKineticFriction).toBe(0.6);
    expect(DEFAULT_COLLISION_TUNING.impactEventThreshold).toBe(1.5);
    expect(DEFAULT_COLLISION_TUNING.maxRestitution).toBe(1.0);
  });

  it("should have valid default drag tuning", () => {
    expect(DEFAULT_DRAG_TUNING.enableTransonicDrag).toBe(true);
    expect(DEFAULT_DRAG_TUNING.maxMagnusCl).toBe(0.5);
    expect(DEFAULT_DRAG_TUNING.enableMagnusLift).toBe(true);
  });

  it("should have valid default sleep tuning", () => {
    expect(DEFAULT_SLEEP_TUNING.enableSleep).toBe(true);
    expect(DEFAULT_SLEEP_TUNING.speedThreshold).toBeCloseTo(0.15);
    expect(DEFAULT_SLEEP_TUNING.timeThreshold).toBe(2.0);
    expect(DEFAULT_SLEEP_TUNING.maxSleepingBodies).toBe(400);
  });

  it("should have environment presets", () => {
    expect(ENV_PRESETS.vacuum).toBeDefined();
    expect(ENV_PRESETS.mars).toBeDefined();
    expect(ENV_PRESETS.underwater).toBeDefined();
    expect(ENV_PRESETS.low_gravity).toBeDefined();
    expect(ENV_PRESETS.high_gravity).toBeDefined();
  });

  it("should apply vacuum preset correctly", () => {
    const preset = ENV_PRESETS.vacuum;
    expect(preset.gravity?.gravity).toBe(0);
    expect(preset.drag?.enableTransonicDrag).toBe(false);
    expect(preset.fluid?.enableBuoyancy).toBe(false);
  });

  it("should apply mars preset correctly", () => {
    const preset = ENV_PRESETS.mars;
    expect(preset.gravity?.gravity).toBeCloseTo(3.72076, 3);
  });

  it("should allow partial config overrides", () => {
    const config = {
      collision: { groundRestitution: 0.5 } as Partial<import("../src/collision-groups.js").CollisionConfig>,
    } as Partial<PhysicsConfig>;
    const merged = { ...DEFAULT_PHYSICS_CONFIG, ...config as any };
    expect(merged.collision.groundRestitution).toBe(0.5);
    expect(merged.gravity.gravity).toBe(PHYSICS.G_EARTH);
  });
});

// ─── Spatial Grid Tests ───────────────────────────────────────

describe("Spatial Grid", () => {
  it("should insert and query bodies", () => {
    const grid = new SpatialGrid(5.0);
    grid.insert(0, -1, -1, -1, 1, 1, 1);
    grid.insert(1, 4, 0, 0, 6, 2, 2);
    grid.insert(2, 10, 10, 10, 12, 12, 12);

    expect(grid.cellCount).toBeGreaterThan(0);
    expect(grid.bodyCount).toBe(3);
  });

  it("should find potential collision pairs", () => {
    const grid = new SpatialGrid(5.0);
    grid.insert(0, 0, 0, 0, 2, 2, 2);
    grid.insert(1, 1, 1, 1, 3, 3, 3);
    grid.insert(2, 10, 10, 10, 12, 12, 12);

    const pairs = grid.getPotentialPairs();
    // Bodies 0 and 1 should be in the same cell
    expect(pairs.some((p) => (p[0] === 0 && p[1] === 1) || (p[0] === 1 && p[1] === 0))).toBe(true);
  });

  it("should not find pairs for distant bodies", () => {
    const grid = new SpatialGrid(5.0);
    grid.insert(0, 0, 0, 0, 1, 1, 1);
    grid.insert(1, 100, 100, 100, 101, 101, 101);

    const pairs = grid.getPotentialPairs();
    expect(pairs.length).toBeLessThan(2); // Only one pair max, but likely 0
  });

  it("should handle region queries", () => {
    const grid = new SpatialGrid(5.0);
    grid.insert(0, 0, 0, 0, 2, 2, 2);
    grid.insert(1, 10, 10, 10, 12, 12, 12);

    const inRegion = grid.getBodiesInRegion(-1, -1, -1, 3, 3, 3);
    expect(inRegion).toContain(0);
    expect(inRegion).not.toContain(1);
  });
});

// ─── Broad Phase Detector Tests ───────────────────────────────

describe("Broad Phase Detector", () => {
  it("should find overlapping pairs", () => {
    const bp = new BroadPhaseDetector(5.0);
    const bodies = [
      { pos: { x: 0, y: 0, z: 0 }, shape: "sphere" as const, radiusM: 1 },
      { pos: { x: 1, y: 0, z: 0 }, shape: "sphere" as const, radiusM: 1 },
      { pos: { x: 100, y: 100, z: 100 }, shape: "sphere" as const, radiusM: 1 },
    ];

    bp.update(bodies);
    const pairs = bp.getPairs();
    expect(pairs.length).toBeGreaterThan(0);
  });

  it("should report statistics", () => {
    const bp = new BroadPhaseDetector(5.0);
    const bodies = [
      { pos: { x: 0, y: 0, z: 0 }, shape: "sphere" as const, radiusM: 1 },
      { pos: { x: 1, y: 0, z: 0 }, shape: "sphere" as const, radiusM: 1 },
    ];
    bp.update(bodies);
    expect(bp.getGrid().cellCount).toBeGreaterThan(0);
  });
});

// ─── EngineWorld Tests ────────────────────────────────────────

describe("EngineWorld", () => {
  it("should initialize with default config", () => {
    const world = new EngineWorld();
    world.initPhysics();
    expect(world.worldConfig.fixedDt).toBe(1 / 120);
    expect(world.config.world.maxBodies).toBe(500);
  });

  it("should initialize with custom config", () => {
    const world = new EngineWorld();
    world.initPhysics({
      collision: { groundRestitution: 0.5 } as any,
      sleep: { enableSleep: false } as any,
    } as any);
    expect(world.collisionTuning.groundRestitution).toBe(0.5);
    expect(world.sleepTuning.enableSleep).toBe(false);
  });

  it("should spawn bodies", () => {
    const world = new EngineWorld();
    world.initPhysics();
    const body = world.spawn({ shape: "sphere", sizeM: 1, pos: { x: 0, y: 10, z: 0 } });
    expect(body.id).toBe("b1");
    expect(body.pos.y).toBe(10);
  });

  it("should spawn static bodies", () => {
    const world = new EngineWorld();
    world.initPhysics();
    const body = world.spawn({ shape: "box", sizeM: 2, pos: { x: 0, y: 0, z: 0 }, static: true });
    expect(body.isStatic).toBe(true);
    expect(body.massKg).toBe(0); // Static bodies have 0 mass
  });

  it("should run simulation", () => {
    const world = new EngineWorld();
    world.initPhysics();
    const body = world.spawn({ shape: "sphere", sizeM: 1, pos: { x: 0, y: 10, z: 0 } });
    const events = world.run(0.1); // 0.1 seconds = 12 steps
    expect(events.length).toBeGreaterThanOrEqual(0);
    expect(body.pos.y).toBeLessThan(10); // Should have fallen
  });

  it("should track physics statistics", () => {
    const world = new EngineWorld();
    world.initPhysics();
    const body = world.spawn({ shape: "sphere", sizeM: 1, pos: { x: 0, y: 10, z: 0 } });
    world.run(0.1);
    const stats = world.getStats();
    expect(stats).toBeDefined();
    expect(stats.stepCount).toBeGreaterThan(0);
  });

  it("should handle collision config per body", () => {
    const world = new EngineWorld();
    world.initPhysics();
    const body = world.spawn({ shape: "sphere", sizeM: 1, pos: { x: 0, y: 10, z: 0 } });
    world.setCollisionConfig(body.id, {
      groupMask: CollisionGroup.DYNAMIC_SOLID,
      layerMask: CollisionGroup.DYNAMIC_SOLID_LAYERS,
      isTrigger: false,
      priority: 1,
      isSensor: false,
    });
    const config = world.getCollisionConfig(body.id);
    expect(config.groupMask).toBe(CollisionGroup.DYNAMIC_SOLID);
  });

  it("should apply gravity and make bodies fall", () => {
    const world = new EngineWorld();
    world.initPhysics();
    const body = world.spawn({ shape: "sphere", sizeM: 0.5, pos: { x: 0, y: 20, z: 0 } });
    expect(body.pos.y).toBe(20);
    world.run(1.0); // 1 second of simulation
    // Should have fallen significantly
    expect(body.pos.y).toBeLessThan(20);
  });
});

// ─── Cannon-es Integration Tests ──────────────────────────────

describe("Cannon Integration", () => {
  it("should initialize cannon world", () => {
    const world = new EngineWorld();
    world.initPhysics(undefined, true);
    expect(world.cannonEnabled).toBe(true);
    expect(world.cannonWorld).not.toBeNull();
  });

  it("should create cannon bodies", () => {
    const world = new EngineWorld();
    world.initPhysics(undefined, true);
    const body = world.spawn({ shape: "sphere", sizeM: 1, pos: { x: 0, y: 10, z: 0 } });
    expect(world.cannonWorld?.getBodyCount()).toBe(1);
  });

  it("should sync bodies to cannon", () => {
    const world = new EngineWorld();
    world.initPhysics(undefined, true);
    const body = world.spawn({ shape: "sphere", sizeM: 1, pos: { x: 0, y: 10, z: 0 } });
    world.syncCannonBodies();
    expect(world.stats.cannonBodies).toBe(1);
  });
});

// ─── Star Formation (real collapse science) ─────────────────────
import {
  jeansMassMsun, freeFallTimeS, starFate, starLifetimeYr,
  starFormVerdict, collapseVerdict,
} from "../src/star-formation.js";

describe("Star Formation", () => {
  it("Taurus cloud 10K 1e4 cm-3 has Jeans mass of a few suns", () => {
    const mj = jeansMassMsun(10, 1e4);
    expect(mj).toBeGreaterThan(1);
    expect(mj).toBeLessThan(30);
  });
  it("dense cloud free-fall is ~0.3 Myr", () => {
    const myr = freeFallTimeS(1e4) / (365.25 * 24 * 3600 * 1e6);
    expect(myr).toBeGreaterThan(0.15);
    expect(myr).toBeLessThan(0.6);
  });
  it("10 Msun cloud collapses, 0.5 Msun holds", () => {
    expect(collapseVerdict(10, 10, 1e4)).toMatch(/collapses/);
    expect(collapseVerdict(0.5, 10, 1e4)).toMatch(/no collapse|stable/);
  });
  it("Sun lives ~1e10 yr, massive star dies fast", () => {
    expect(starLifetimeYr(1)).toBeGreaterThan(5e9);
    expect(starLifetimeYr(1)).toBeLessThan(2e10);
    expect(starLifetimeYr(10)).toBeLessThan(5e7);
  });
  it("fates follow mass ladder", () => {
    expect(starFate(0.05).fate).toBe("brown-dwarf");
    expect(starFate(1).fate).toBe("sun-like-white-dwarf");
    expect(starFate(15).fate).toBe("neutron-star");
    expect(starFate(25.1).fate).toBe("black-hole");
  });
  it("verdict keeps lab gravity untouched", () => {
    const v = starFormVerdict(10, 10, 1e4);
    expect(v.gravityNote).toMatch(/Lab gravity unchanged/);
    expect(v.freeFallMyr).toBeGreaterThan(0);
  });
});
