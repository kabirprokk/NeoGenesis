// Cloud physics test suite — validates wind-driven cloud movement,
// cloud formation/dissipation, precipitation physics, and atmospheric
// altitude-coupled cloud behavior for the NeoGenesis engine.

import { describe, it, expect } from "vitest";
import {
  CloudPhysicsEngine,
  createCloudFactory,
  CloudType,
  CloudLayer,
  CLOUD_PHYSICS_DEFAULTS,
  DEFAULT_CLOUD_CONFIG,
  type CloudBody,
  type CloudConfig,
  type CloudSimState,
  type CloudStatistics,
  type CloudPhysicsParams,
} from "../src/cloud-physics.js";

// ─── Cloud Engine Initialization ───────────────────────

describe("Cloud Physics Engine", () => {
  it("should initialize with default config", () => {
    const engine = new CloudPhysicsEngine();
    expect(engine.config.enableClouds).toBe(true);
    expect(engine.config.enableWindAdvection).toBe(true);
    expect(engine.config.enableTurbulence).toBe(true);
    expect(engine.config.enablePrecipitation).toBe(true);
    expect(engine.config.maxClouds).toBe(200);
  });

  it("should initialize with custom config", () => {
    const engine = createCloudFactory({
      enableWindAdvection: false,
      maxClouds: 50,
    });
    expect(engine.config.enableWindAdvection).toBe(false);
    expect(engine.config.maxClouds).toBe(50);
  });

  it("should have all cloud type defaults", () => {
    expect(CLOUD_PHYSICS_DEFAULTS.cirrus).toBeDefined();
    expect(CLOUD_PHYSICS_DEFAULTS.cumulus).toBeDefined();
    expect(CLOUD_PHYSICS_DEFAULTS.cumulonimbus).toBeDefined();
    expect(CLOUD_PHYSICS_DEFAULTS.stratus).toBeDefined();
    expect(CLOUD_PHYSICS_DEFAULTS.fog).toBeDefined();
  });

  it("should have default physics params", () => {
    const cumulus = CLOUD_PHYSICS_DEFAULTS.cumulus!;
    expect(cumulus.updraftSpeed).toBe(3.0);
    expect(cumulus.turbulentDiffusivity).toBe(40);
    expect(cumulus.liquidWaterContent).toBe(150);
  });
});

// ─── Cloud Spawning ────────────────────────────────────

describe("Cloud Spawning", () => {
  it("should spawn a cloud", () => {
    const engine = new CloudPhysicsEngine();
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    expect(cloud.id).toBe("cloud-1");
    expect(cloud.type).toBe(CloudType.CUMULUS);
    expect(cloud.pos.y).toBe(1000);
    expect(engine.bodies.length).toBe(1);
  });

  it("should spawn different cloud types", () => {
    const engine = new CloudPhysicsEngine();
    engine.spawnCloud(CloudType.CIRRUS, { x: 0, y: 8000, z: 0 });
    engine.spawnCloud(CloudType.STRATOCUMULUS, { x: 0, y: 1500, z: 0 });
    engine.spawnCloud(CloudType.CUMULONIMBUS, { x: 0, y: 3000, z: 0 });
    expect(engine.bodies.length).toBe(3);
  });

  it("should enforce max cloud limit", () => {
    const engine = createCloudFactory({ maxClouds: 2 });
    engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    engine.spawnCloud(CloudType.CUMULUS, { x: 100, y: 2000, z: 0 });
    engine.spawnCloud(CloudType.CUMULUS, { x: 200, y: 3000, z: 0 });
    // Should have dissipated oldest cloud
    expect(engine.bodies.length).toBeLessThanOrEqual(2);
  });

  it("should set wind velocity on spawn", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 2000, z: 0 });
    expect(cloud.vel.x).toBe(cloud.windVel.x);
  });
});

// ─── Wind Profile ──────────────────────────────────────

describe("Wind Profile", () => {
  it("should generate a wind profile", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 });
    expect(engine.windProfile.length).toBeGreaterThan(0);
  });

  it("should return wind at altitude with interpolation", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 });
    const wind = engine.getWindAtAltitude(5000);
    expect(wind.x).toBeGreaterThan(0);
    expect(wind.z).toBeGreaterThan(0);
  });

  it("should have jet stream at high altitude", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 5, y: 0, z: 3 });
    const lowWind = engine.getWindAtAltitude(1000);
    const highWind = engine.getWindAtAltitude(10000);
    // High altitude wind should be stronger due to jet stream
    expect(highWind.x).toBeGreaterThanOrEqual(lowWind.x);
  });
});

// ─── Cloud Physics Update ──────────────────────────────

describe("Cloud Physics Update", () => {
  it("should update cloud position based on wind", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 5, y: 0, z: 3 });
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    const initialX = cloud.pos.x;
    const initialZ = cloud.pos.z;
    engine.update(0.1); // 0.1 seconds
    // Cloud should have moved in wind direction
    expect(cloud.pos.x).toBeGreaterThanOrEqual(initialX);
  });

  it("should have cloud lifetime", () => {
    const engine = new CloudPhysicsEngine();
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    expect(cloud.lifetime).toBe(0);
    expect(cloud.maxLifetime).toBeGreaterThan(0);
  });

  it("should track statistics", () => {
    const engine = new CloudPhysicsEngine();
    engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    engine.update(0.1);
    const stats = engine.cloudStats;
    expect(stats.totalClouds).toBeGreaterThanOrEqual(0);
    expect(stats.totalCloudCover).toBeGreaterThanOrEqual(0);
  });
});

// ─── Cloud Dissipation ──────────────────────────────────

describe("Cloud Dissipation", () => {
  it("should dissipate clouds with low humidity", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.dissipationHumidity = 0.3;
    engine.setWeather(0.2, 288.15, 101325);
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    engine.update(1000); // 1000 seconds ensures lifetime > 300 and density reaches 0
    expect(engine.bodies.find((b) => b.id === cloud.id)).toBeUndefined();
  });

  it("should maintain clouds with high humidity", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.dissipationHumidity = 0.9; // Dissipate if humidity < 90%
    engine.setWeather(0.8, 288.15, 101325); // High humidity
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    engine.update(10);
    expect(engine.bodies.find((b) => b.id === cloud.id)).toBeDefined();
  });
});

// ─── Precipitation Physics ────────────────────────────

describe("Precipitation Physics", () => {
  it("should compute precipitation for dense clouds", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.precipThreshold = 0.5;
    const cloud = engine.spawnCloud(CloudType.CUMULONIMBUS, { x: 0, y: 3000, z: 0 });
    cloud.liquidWaterContent = 300;
    cloud.dropletSize = 25; // Must be > 20
    engine.update(1);
    expect(cloud.precipitationRate).toBeGreaterThan(0);
  });

  it("should not compute precipitation for thin clouds", () => {
    const engine = new CloudPhysicsEngine();
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    cloud.liquidWaterContent = 0.1;
    cloud.dropletSize = 5;
    engine.update(1);
    expect(cloud.precipitationRate).toBe(0);
  });
});

// ─── Cloud Formation from Weather ─────────────────────

describe("Cloud Formation from Weather", () => {
  it("should add clouds from weather data", () => {
    const engine = new CloudPhysicsEngine();
    engine.addCloudsFromWeather({
      cloudCover: 0.5,
      humidity: 0.8,
      temperature: 288.15,
      windSpeed: 10,
      windDir: 180,
    });
    expect(engine.bodies.length).toBeGreaterThan(0);
  });

  it("should spawn multiple clouds based on cloud cover", () => {
    const engine = new CloudPhysicsEngine();
    engine.addCloudsFromWeather({
      cloudCover: 0.8,
      humidity: 0.9,
      temperature: 280,
      windSpeed: 15,
      windDir: 90,
    });
    expect(engine.bodies.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Cloud State and Rendering Data ────────────────────

describe("Cloud State", () => {
  it("should return simulation state", () => {
    const engine = new CloudPhysicsEngine();
    engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    const state = engine.getState();
    expect(state.bodies.length).toBe(1);
    expect(state.time).toBe(0);
    expect(state.humidity).toBe(0.5);
  });

  it("should return render data", () => {
    const engine = new CloudPhysicsEngine();
    engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    const renderData = engine.getCloudRenderData();
    expect(renderData.length).toBe(1);
    expect(renderData[0].pos.x).toBe(0);
    expect(renderData[0].density).toBeGreaterThanOrEqual(0);
    expect(renderData[0].isPrecipitating).toBeDefined();
  });
});

// ─── Cloud Physics Parameters ──────────────────────────

describe("Cloud Physics Parameters", () => {
  it("should have default config", () => {
    expect(DEFAULT_CLOUD_CONFIG.enableClouds).toBe(true);
    expect(DEFAULT_CLOUD_CONFIG.cloudTickRate).toBe(10);
    expect(DEFAULT_CLOUD_CONFIG.formationHumidity).toBe(0.8);
    expect(DEFAULT_CLOUD_CONFIG.dissipationHumidity).toBe(0.5);
  });

  it("should have valid cloud physics params", () => {
    const params = CLOUD_PHYSICS_DEFAULTS.cirrus!;
    expect(params).toBeDefined();
    expect(params.fallSpeed).toBe(0.3);
    expect(params.turbulentDiffusivity).toBe(50);
  });
});
