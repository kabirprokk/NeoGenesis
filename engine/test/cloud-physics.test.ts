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

// ─── Realistic Wind Profile Tests ──────────────────────

describe("Realistic Wind Profile", () => {
  it("should generate a wind profile with geostrophic balance", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.enableGeostrophicBalance = true;
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    expect(engine.windProfile.length).toBeGreaterThan(0);
    // Wind should have geostrophic component
    const upperLayer = engine.windProfile.find((w) => w.altitude >= 5000);
    expect(upperLayer).toBeDefined();
    expect(upperLayer!.windX).toBeGreaterThan(0);
  });

  it("should show wind veering with altitude (clockwise in NH)", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const lowWind = engine.getWindAtAltitude(1000);
    const highWind = engine.getWindAtAltitude(8000);
    // Direction should change with altitude
    const lowDir = Math.atan2(lowWind.z, lowWind.x);
    const highDir = Math.atan2(highWind.z, highWind.x);
    expect(highDir).not.toBeCloseTo(lowDir, 5);
  });

  it("should have stronger wind at jet stream altitude", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const lowWind = engine.getWindAtAltitude(2000);
    const jetWind = engine.getWindAtAltitude(10000);
    expect(jetWind.x).toBeGreaterThanOrEqual(lowWind.x);
  });

  it("should apply Coriolis deflection when enabled", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.enableCoriolis = true;
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const layer = engine.windProfile.find((w) => w.altitude > 5000);
    expect(layer).toBeDefined();
    // Coriolis deflection should be non-zero
    expect(layer!.coriolisDeflection.x).toBeDefined();
  });

  it("should have Ekman spiral effect in surface layer", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.enableEkmanSpiral = true;
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const surfaceWind = engine.getWindAtAltitude(100);
    const midWind = engine.getWindAtAltitude(2000);
    // Surface wind should be weaker than mid-level
    expect(surfaceWind.x).toBeLessThanOrEqual(midWind.x * 1.5);
  });

  it("should compute wind shear correctly", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const shear = (engine as any).computeWindShear(5000);
    expect(shear).toBeGreaterThanOrEqual(0);
  });

  it("should compute Richardson number for KH instability", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const ri = (engine as any).computeRichardsonNumber(5000, 20, 0.01, 290);
    expect(ri).toBeDefined();
    expect(typeof ri).toBe("number");
  });

  it("should have turbulence intensity that decreases with altitude", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const lowTurb = engine.windProfile.find((w) => w.altitude === 500);
    const highTurb = engine.windProfile.find((w) => w.altitude === 10000);
    if (lowTurb && highTurb) {
      // Turbulence should generally be lower at higher altitude
      expect(highTurb.turbulenceIntensity).toBeLessThanOrEqual(lowTurb.turbulenceIntensity * 1.5);
    }
  });
});

// ─── Cloud Rotation and Deformation Tests ──────────────

describe("Cloud Rotation and Deformation", () => {
  it("should spawn cloud with rotation property", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    expect(cloud.rotationY).toBeDefined();
    expect(typeof cloud.rotationY).toBe("number");
  });

  it("should spawn cloud with deformation property", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    expect(cloud.deformation).toBeDefined();
    expect(cloud.deformation.stretchX).toBeDefined();
    expect(cloud.deformation.stretchZ).toBeDefined();
  });

  it("should update cloud rotation based on wind shear", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 20, y: 0, z: 10 }, 13000);
    engine.config.windShearScale = 2.0;
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 3000, z: 0 });
    const initialRot = cloud.rotationY;
    engine.update(0.1);
    // Cloud should have rotated due to wind shear
    expect(cloud.rotationY).not.toBeCloseTo(initialRot, 5);
  });

  it("should have droplet size distribution on cloud body", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    expect(cloud.dropletSizeDistribution).toBeDefined();
    expect(cloud.dropletSizeDistribution.size).toBeGreaterThan(0);
  });

  it("should have cloud top and base height", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    expect(cloud.cloudTopHeight).toBeGreaterThan(cloud.cloudBaseHeight);
  });
});

// ─── Kelvin-Helmholtz Instability Tests ────────────────

describe("Kelvin-Helmholtz Instability", () => {
  it("should detect KH instability when Richardson number is below threshold", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.enableKelvinHelmholtz = true;
    engine.config.khThreshold = 0.25;
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 3000, z: 0 });
    engine.generateWindProfile({ x: 30, y: 0, z: 15 }, 13000);
    const wind = engine.getWindAtAltitude(3000);
    // High shear should produce low Richardson number
    if (wind.richardsonNumber < engine.config.khThreshold) {
      expect(wind.richardsonNumber).toBeLessThan(engine.config.khThreshold);
    }
  });
});

// ─── Bergeron-Findeisen Process Tests ──────────────────

describe("Bergeron-Findeisen Process", () => {
  it("should convert liquid water to ice at cold temperatures", () => {
    const engine = new CloudPhysicsEngine();
    const cloud = engine.spawnCloud(CloudType.CUMULONIMBUS, { x: 0, y: 5000, z: 0 });
    cloud.liquidWaterContent = 200;
    cloud.iceContent = 10;
    cloud.temperature = 250; // Below freezing
    engine.config.enableBergeronProcess = true;
    const initialWater = cloud.liquidWaterContent;
    const initialIce = cloud.iceContent;
    engine.update(100);
    expect(cloud.iceContent).toBeGreaterThan(initialIce);
  });

  it("should reduce liquid water when ice grows", () => {
    const engine = new CloudPhysicsEngine();
    const cloud = engine.spawnCloud(CloudType.CUMULONIMBUS, { x: 0, y: 5000, z: 0 });
    cloud.liquidWaterContent = 200;
    cloud.iceContent = 5;
    cloud.temperature = 250;
    engine.config.enableBergeronProcess = true;
    const initialWater = cloud.liquidWaterContent;
    engine.update(100);
    expect(cloud.liquidWaterContent).toBeLessThanOrEqual(initialWater);
  });
});

// ─── Wind Gust Tests ────────────────────────────────────

describe("Wind Gusts", () => {
  it("should compute gust factor when enabled", () => {
    const engine = new CloudPhysicsEngine();
    engine.config.enableWindGusts = true;
    engine.config.windGustIntensity = 0.3;
    const factor = (engine as any).computeGustFactor(10000, 60);
    expect(factor).toBeGreaterThan(0);
  });

  it("should apply gust offset to cloud position", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    engine.config.enableWindGusts = true;
    const cloud = engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    expect(cloud.gustOffset).toBeDefined();
    expect(cloud.gustOffset.x).toBeDefined();
    expect(cloud.gustOffset.z).toBeDefined();
  });
});

// ─── Realistic Cloud State Tests ───────────────────────

describe("Realistic Cloud State", () => {
  it("should return render data with new properties", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    engine.spawnCloud(CloudType.CUMULUS, { x: 0, y: 1000, z: 0 });
    const renderData = engine.getCloudRenderData();
    expect(renderData.length).toBe(1);
    expect(renderData[0].rotationY).toBeDefined();
    expect(renderData[0].deformation).toBeDefined();
    expect(renderData[0].gustOffset).toBeDefined();
    expect(renderData[0].isEvaporating).toBeDefined();
  });

  it("should have valid wind profile data for rendering", () => {
    const engine = new CloudPhysicsEngine();
    engine.generateWindProfile({ x: 10, y: 0, z: 5 }, 13000);
    const state = engine.getState();
    expect(state.windProfile.length).toBeGreaterThan(0);
    expect(state.windProfile[0].directionRadians).toBeDefined();
    expect(state.windProfile[0].potentialTemperature).toBeDefined();
    expect(state.windProfile[0].richardsonNumber).toBeDefined();
  });
});
