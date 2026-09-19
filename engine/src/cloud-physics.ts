// Real-world cloud physics simulation engine.
// Models cloud formation, movement, and dissipation using
// atmospheric science: humidity, temperature, wind shear,
// turbulence, droplet physics, and precipitation.
//
// Cloud types and their real-world physics:
//   - Cirrus:   high ice crystals (>6000m), wispy, wind-driven
//   - Cirrocumulus: mid-high ice crystals, rippled
//   - Altocumulus: mid-level, patchy
//   - Stratus:  low-level, flat, uniform layer
//   - Stratocumulus: low, lumpy, moderate thickness
//   - Cumulus:  low, puffy, thermal-driven
//   - Cumulonimbus: towering, thunderstorm, precipitation
//   - Nimbostratus: mid-level, steady precipitation

import { PHYSICS } from "./constants.js";
import { altitudeDensity, us76Atmo } from "./science.js";

// ─── Cloud Type Definitions ──────────────────────────────────

export enum CloudType {
  CIRRUS = "cirrus",
  CIRROCUMULUS = "cirrocumulus",
  ALTOCUMULUS = "altocumulus",
  ALTOSTRATUS = "altostratus",
  STRATUS = "stratus",
  STRATOCUMULUS = "stratocumulus",
  CUMULUS = "cumulus",
  CUMULONIMBUS = "cumulonimbus",
  NIMBOSTRATUS = "nimbostratus",
  FOG = "fog",
}

export enum CloudLayer {
  LOW = "low",       // 0-2000m
  MID = "mid",       // 2000-7000m
  HIGH = "high",     // 6000-13000m
  CIRRUS = "cirrus", // >6000m (ice crystal region)
}

// ─── Cloud Physics Parameters ──────────────────────────────

export interface CloudPhysicsParams {
  /** Critical supersaturation ratio for droplet activation (typically 0.008-0.012) */
  criticalSupersaturation: number;
  /** Maximum droplet concentration per cm³ (Clean air: ~100, polluted: ~1000) */
  dropletNumberDensity: number; // per cm³
  /** Typical droplet radius in μm */
  meanDropletRadius: number;
  /** Cloud water content g/m³ */
  liquidWaterContent: number; // g/m³
  /** Ice crystal concentration (for ice clouds) per L */
  iceCrystalDensity: number; // per liter
  /** Fall speed of droplets m/s */
  fallSpeed: number; // m/s
  /** Turbulent diffusivity m²/s */
  turbulentDiffusivity: number; // m²/s
  /** Thermal updraft speed m/s (for convective clouds) */
  updraftSpeed: number; // m/s
  /** Cloud top temperature (K) */
  cloudTopTemp: number;
  /** Cloud base temperature (K) */
  cloudBaseTemp: number;
  /** Whether cloud contains ice */
  hasIce: boolean;
  /** Precipitation efficiency (0-1) */
  precipEfficiency: number;
  /** Horizontal extent in meters (typical width) */
  horizontalExtent: number;
  /** Thickness in meters */
  thickness: number;
  /** Base density/opacity (0-1) */
  density: number;
}

export const CLOUD_PHYSICS_DEFAULTS: Record<string, Partial<CloudPhysicsParams>> = {
  cirrus: {
    criticalSupersaturation: 0.008,
    dropletNumberDensity: 0, // ice crystals
    meanDropletRadius: 30, // μm ice crystals
    liquidWaterContent: 0,
    iceCrystalDensity: 1, // per liter
    fallSpeed: 0.3,
    turbulentDiffusivity: 50,
    updraftSpeed: 0,
    cloudTopTemp: 220,
    cloudBaseTemp: 230,
    hasIce: true,
    precipEfficiency: 0.1,
  },
  cirrocumulus: {
    criticalSupersaturation: 0.008,
    dropletNumberDensity: 0,
    meanDropletRadius: 25,
    liquidWaterContent: 0,
    iceCrystalDensity: 2,
    fallSpeed: 0.2,
    turbulentDiffusivity: 40,
    updraftSpeed: 0,
    cloudTopTemp: 225,
    cloudBaseTemp: 235,
    hasIce: true,
    precipEfficiency: 0.05,
  },
  altocumulus: {
    criticalSupersaturation: 0.010,
    dropletNumberDensity: 200,
    meanDropletRadius: 10,
    liquidWaterContent: 50,
    iceCrystalDensity: 0.5,
    fallSpeed: 0.5,
    turbulentDiffusivity: 30,
    updraftSpeed: 0.5,
    cloudTopTemp: 260,
    cloudBaseTemp: 275,
    hasIce: true,
    precipEfficiency: 0.1,
  },
  altostratus: {
    criticalSupersaturation: 0.010,
    dropletNumberDensity: 300,
    meanDropletRadius: 12,
    liquidWaterContent: 100,
    iceCrystalDensity: 0.3,
    fallSpeed: 0.4,
    turbulentDiffusivity: 25,
    updraftSpeed: 0.3,
    cloudTopTemp: 255,
    cloudBaseTemp: 270,
    hasIce: true,
    precipEfficiency: 0.15,
  },
  stratus: {
    criticalSupersaturation: 0.010,
    dropletNumberDensity: 100,
    meanDropletRadius: 8,
    liquidWaterContent: 30,
    iceCrystalDensity: 0,
    fallSpeed: 0.2,
    turbulentDiffusivity: 10,
    updraftSpeed: 0,
    cloudTopTemp: 280,
    cloudBaseTemp: 285,
    hasIce: false,
    precipEfficiency: 0.2,
  },
  stratocumulus: {
    criticalSupersaturation: 0.010,
    dropletNumberDensity: 150,
    meanDropletRadius: 10,
    liquidWaterContent: 80,
    iceCrystalDensity: 0,
    fallSpeed: 0.3,
    turbulentDiffusivity: 20,
    updraftSpeed: 0.2,
    cloudTopTemp: 275,
    cloudBaseTemp: 280,
    hasIce: false,
    precipEfficiency: 0.25,
  },
  cumulus: {
    criticalSupersaturation: 0.012,
    dropletNumberDensity: 400,
    meanDropletRadius: 12,
    liquidWaterContent: 150,
    iceCrystalDensity: 0,
    fallSpeed: 0.5,
    turbulentDiffusivity: 40,
    updraftSpeed: 3.0,
    cloudTopTemp: 270,
    cloudBaseTemp: 280,
    hasIce: false,
    precipEfficiency: 0.3,
  },
  cumulonimbus: {
    criticalSupersaturation: 0.012,
    dropletNumberDensity: 600,
    meanDropletRadius: 15,
    liquidWaterContent: 300,
    iceCrystalDensity: 5,
    fallSpeed: 1.0,
    turbulentDiffusivity: 80,
    updraftSpeed: 10.0,
    cloudTopTemp: 220,
    cloudBaseTemp: 290,
    hasIce: true,
    precipEfficiency: 0.6,
  },
  nimbostratus: {
    criticalSupersaturation: 0.010,
    dropletNumberDensity: 500,
    meanDropletRadius: 14,
    liquidWaterContent: 200,
    iceCrystalDensity: 1,
    fallSpeed: 0.8,
    turbulentDiffusivity: 30,
    updraftSpeed: 0.5,
    cloudTopTemp: 250,
    cloudBaseTemp: 270,
    hasIce: true,
    precipEfficiency: 0.5,
  },
  fog: {
    criticalSupersaturation: 0.010,
    dropletNumberDensity: 200,
    meanDropletRadius: 5,
    liquidWaterContent: 50,
    iceCrystalDensity: 0,
    fallSpeed: 0.01,
    turbulentDiffusivity: 5,
    updraftSpeed: 0,
    cloudTopTemp: 280,
    cloudBaseTemp: 280,
    hasIce: false,
    precipEfficiency: 0.05,
  },
};

// Fill in missing default fields
const DEFAULT_PHYSICS_FILL: Partial<CloudPhysicsParams> = {
  horizontalExtent: 2000,
  thickness: 500,
  density: 0.5,
};

for (const key of Object.keys(CLOUD_PHYSICS_DEFAULTS)) {
  CLOUD_PHYSICS_DEFAULTS[key] = { ...DEFAULT_PHYSICS_FILL, ...CLOUD_PHYSICS_DEFAULTS[key] };
}

// ─── Cloud Types with visual properties ────────────────────

export interface CloudTypeDefinition {
  type: CloudType;
  layer: CloudLayer;
  baseAltitude: number; // meters
  topAltitude: number; // meters
  thickness: number; // meters
  horizontalExtent: number; // meters (typical width)
  verticalExtent: number; // meters
  coverage: number; // 0-1 (fraction of sky)
  density: number; // 0-1 (opacity)
  color: string; // visual color
  emissivity: number;
}

// ─── Individual Cloud Body ────────────────────────────────

export interface CloudBody {
  id: string;
  type: CloudType;
  physics: CloudPhysicsParams;
  pos: { x: number; y: number; z: number }; // world position in meters
  vel: { x: number; y: number; z: number }; // m/s
  windVel: { x: number; y: number; z: number }; // wind at cloud altitude
  size: { width: number; height: number; depth: number }; // meters
  density: number; // 0-1 (cloud cover opacity)
  temperature: number; // K
  humidity: number; // relative humidity 0-1
  liquidWaterContent: number; // g/m³
  iceContent: number; // g/m³
  dropletSize: number; // μm effective radius
  precipitationRate: number; // mm/h
  thickness: number; // meters
  lifetime: number; // seconds since formation
  maxLifetime: number; // seconds before dissipation
  turbulence: number; // turbulence intensity
  updraftSpeed: number; // m/s vertical
  isPrecipitating: boolean;
  isEvaporating: boolean;
  events: string[];
}

// ─── Wind Profile ───────────────────────────────────────────

export interface WindLayer {
  altitude: number; // meters
  windX: number; // m/s
  windY: number; // m/s
  windZ: number; // m/s
  speed: number; // m/s magnitude
  direction: number; // degrees
  shear: number; // m/s per meter (wind shear)
  turbulenceIntensity: number; // 0-1
}

// ─── Cloud Physics Simulation State ───────────────────────

export interface CloudSimState {
  time: number;
  bodies: CloudBody[];
  windProfile: WindLayer[];
  humidity: number; // global relative humidity 0-1
  temperature: number; // K global average
  pressure: number; // Pa
  precipitation: { type: string; rate: number; intensity: number }[];
  statistics: CloudStatistics;
}

export interface CloudStatistics {
  totalClouds: number;
  totalCloudCover: number;
  precipitatingClouds: number;
  evaporatingClouds: number;
  cloudMass: number;
  precipitationRate: number;
  stepCount: number;
}

// ─── Cloud Physics Configuration ────────────────────────────

export interface CloudConfig {
  /** Enable cloud physics simulation */
  enableClouds: boolean;
  /** Enable wind-driven advection */
  enableWindAdvection: boolean;
  /** Enable turbulence */
  enableTurbulence: boolean;
  /** Enable precipitation physics */
  enablePrecipitation: boolean;
  /** Enable cloud formation/dissipation */
  enableFormation: boolean;
  /** Maximum number of cloud bodies */
  maxClouds: number;
  /** Cloud tick rate (Hz) */
  cloudTickRate: number;
  /** Turbulent diffusivity scale factor */
  turbulenceScale: number;
  /** Wind shear scale factor */
  windShearScale: number;
  /** Precipitation threshold (g/m³ liquid water) */
  precipThreshold: number;
  /** Evaporation rate (mm/h per km distance) */
  evaporationRate: number;
  /** Cloud formation threshold humidity */
  formationHumidity: number; // 0-1
  /** Dissipation threshold humidity */
  dissipationHumidity: number; // 0-1
  /** Enable altitude-coupled atmosphere */
  useAltitudeCoupling: boolean;
  /** Global wind speed multiplier */
  globalWindScale: number;
  /** Thermal updraft strength */
  thermalUpdraftStrength: number;
  // ─── Realistic Wind Parameters ────────────────────
  /** Enable Coriolis effect on wind direction */
  enableCoriolis: boolean;
  /** Coriolis parameter (f = 2Ω sin(φ), default for mid-latitudes ~1e-4) */
  coriolisParameter: number;
  /** Enable Ekman spiral (surface friction turning wind) */
  enableEkmanSpiral: boolean;
  /** Surface friction coefficient (m/s) */
  surfaceFrictionCoeff: number;
  /** Enable geostrophic wind balance */
  enableGeostrophicBalance: boolean;
  /** Pressure gradient force magnitude (Pa/m) for geostrophic wind */
  pressureGradientForce: number;
  /** Jet stream strength multiplier */
  jetStreamStrength: number;
  /** Jet stream altitude range (m) */
  jetStreamAltitudeMin: number;
  jetStreamAltitudeMax: number;
  /** Enable wind gusts */
  enableWindGusts: boolean;
  /** Wind gust intensity multiplier */
  windGustIntensity: number;
  /** Gust correlation time (seconds) */
  gustCorrelationTime: number;
  /** Enable Kelvin-Helmholtz instability at shear layers */
  enableKelvinHelmholtz: boolean;
  /** KH instability threshold (Richardson number) */
  khThreshold: number;
}

export const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  enableClouds: true,
  enableWindAdvection: true,
  enableTurbulence: true,
  enablePrecipitation: true,
  enableFormation: true,
  maxClouds: 200,
  cloudTickRate: 10, // 10 Hz for clouds (slower than physics)
  turbulenceScale: 1.0,
  windShearScale: 1.0,
  precipThreshold: 0.5, // g/m³
  evaporationRate: 0.1,
  formationHumidity: 0.8,
  dissipationHumidity: 0.5,
  useAltitudeCoupling: true,
  globalWindScale: 1.0,
  thermalUpdraftStrength: 1.0,
  // Realistic Wind Parameters
  enableCoriolis: true,
  coriolisParameter: 1.0e-4, // Mid-latitudes (f = 2Ω sin(φ))
  enableEkmanSpiral: true,
  surfaceFrictionCoeff: 0.2, // m/s friction
  enableGeostrophicBalance: true,
  pressureGradientForce: 0.001, // Pa/m
  jetStreamStrength: 1.0,
  jetStreamAltitudeMin: 8000,
  jetStreamAltitudeMax: 12000,
  enableWindGusts: true,
  windGustIntensity: 0.3,
  gustCorrelationTime: 60, // seconds
  enableKelvinHelmholtz: true,
  khThreshold: 0.25, // Richardson number threshold
};

// ─── Cloud Physics Engine ──────────────────────────────────

export class CloudPhysicsEngine {
  config: CloudConfig = { ...DEFAULT_CLOUD_CONFIG };
  bodies: CloudBody[] = [];
  windProfile: WindLayer[] = [];
  time = 0;
  humidity = 0.5;
  temperature = 288.15; // K
  pressure = 101325; // Pa
  cloudStats: CloudStatistics = { totalClouds: 0, totalCloudCover: 0, precipitatingClouds: 0, evaporatingClouds: 0, cloudMass: 0, precipitationRate: 0, stepCount: 0 };
  private nextId = 1;

  // ─── Wind Profile ────────────────────────────────────────

  /** Generate a realistic wind profile using the US-76 atmosphere + jet stream model */
  generateWindProfile(groundWind: { x: number; y: number; z: number }, altitude: number = 13000): void {
    this.windProfile = [];

    // Define standard atmospheric layers
    const layers: { altitude: number; baseWind: { x: number; y: number; z: number }; speed: number }[] = [
      { altitude: 0, baseWind: groundWind, speed: Math.hypot(groundWind.x, groundWind.y, groundWind.z) },
      { altitude: 500, baseWind: groundWind, speed: groundWind ? 3 : 0 },
      { altitude: 1000, baseWind: { x: groundWind.x * 1.2, y: 0, z: groundWind.z * 1.2 }, speed: 5 },
      { altitude: 2000, baseWind: { x: groundWind.x * 1.5, y: 0, z: groundWind.z * 1.5 }, speed: 8 },
      { altitude: 3000, baseWind: { x: groundWind.x * 1.8, y: 0, z: groundWind.z * 1.8 }, speed: 12 },
      { altitude: 5000, baseWind: { x: groundWind.x * 2.0, y: 0, z: groundWind.z * 2.0 }, speed: 15 },
      { altitude: 7000, baseWind: { x: groundWind.x * 2.5, y: 0, z: groundWind.z * 2.5 }, speed: 20 },
      { altitude: 10000, baseWind: { x: groundWind.x * 3.0, y: 0, z: groundWind.z * 3.0 }, speed: 25 }, // Jet stream level
      { altitude: 12000, baseWind: { x: groundWind.x * 3.5, y: 0, z: groundWind.z * 3.5 }, speed: 30 }, // Upper jet stream
      { altitude: altitude, baseWind: { x: groundWind.x * 2.0, y: 0, z: groundWind.z * 2.0 }, speed: 20 },
    ];

    // Add jet stream (typically at 9000-12000m)
    const jetStreamAlt = 10000;
    const jetStreamSpeed = 30 + Math.sin(this.time * 0.001) * 10; // Oscillating jet stream

    for (const layer of layers) {
      const h = layer.altitude;
      let wx = layer.baseWind.x;
      let wz = layer.baseWind.z;

      // Jet stream boost
      if (h >= 8000 && h <= 13000) {
        const jetBoost = (jetStreamSpeed / 30) * (1 - Math.abs(h - jetStreamAlt) / 5000);
        wx += wx > 0 ? jetBoost : -jetBoost;
        wz += wz > 0 ? jetBoost : -jetBoost;
      }

      // Wind shear increases with altitude
      const shear = 0.002 + (h / altitude) * 0.008;
      const turbulence = 0.05 + (h / altitude) * 0.3;

      this.windProfile.push({
        altitude: h,
        windX: wx,
        windY: 0,
        windZ: wz,
        speed: Math.hypot(wx, 0, wz),
        direction: Math.atan2(wz, wx) * (180 / Math.PI),
        shear: shear,
        turbulenceIntensity: turbulence,
      });
    }
  }

  /** Get wind at a specific altitude with interpolation */
  getWindAtAltitude(altitude: number): { x: number; y: number; z: number } {
    if (this.windProfile.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    // Find bracketing layers
    let lower = this.windProfile[0];
    let upper = this.windProfile[this.windProfile.length - 1];

    for (let i = 0; i < this.windProfile.length - 1; i++) {
      if (altitude >= this.windProfile[i].altitude && altitude <= this.windProfile[i + 1].altitude) {
        lower = this.windProfile[i];
        upper = this.windProfile[i + 1];
        break;
      }
    }

    const range = upper.altitude - lower.altitude;
    if (range < 1) return { x: upper.windX, y: 0, z: upper.windZ };

    const t = Math.max(0, Math.min(1, (altitude - lower.altitude) / range));
    // Smooth interpolation
    const st = t * t * (3 - 2 * t); // smoothstep

    return {
      x: lower.windX + (upper.windX - lower.windX) * st,
      y: 0,
      z: lower.windZ + (upper.windZ - lower.windZ) * st,
    };
  }

  // ─── Cloud Creation ──────────────────────────────────────

  /** Create a cloud body at a given position */
  spawnCloud(
    type: CloudType,
    pos: { x: number; y: number; z: number },
    size?: { width?: number; height?: number; depth?: number }
  ): CloudBody {
    if (this.bodies.length >= this.config.maxClouds) {
      // Dissolve oldest cloud
      this.dissipateCloud(this.bodies[0].id);
    }

const physics = CLOUD_PHYSICS_DEFAULTS[type] ?? CLOUD_PHYSICS_DEFAULTS.cumulus!;
    const fill = DEFAULT_PHYSICS_FILL;
    const resolvedPhysics = { ...fill, ...physics } as CloudPhysicsParams;
    const alt = pos.y;
    const wind = this.getWindAtAltitude(alt);
    const sizeX = size?.width ?? (resolvedPhysics.horizontalExtent! * (0.5 + Math.random() * 0.5));
    const sizeY = size?.height ?? (resolvedPhysics.thickness! * (0.5 + Math.random() * 0.5));
    const sizeZ = size?.depth ?? (resolvedPhysics.horizontalExtent! * (0.5 + Math.random() * 0.5));

    const body: CloudBody = {
      id: `cloud-${this.nextId++}`,
      type,
      physics: resolvedPhysics,
      pos,
      vel: { x: wind.x, y: 0, z: wind.z },
      windVel: { ...wind },
      size: { width: sizeX, height: sizeY, depth: sizeZ },
      density: resolvedPhysics.density!,
      temperature: resolvedPhysics.cloudBaseTemp - 5 + Math.random() * 10,
      humidity: this.humidity,
      liquidWaterContent: resolvedPhysics.liquidWaterContent,
      iceContent: resolvedPhysics.hasIce ? resolvedPhysics.liquidWaterContent * 0.3 : 0,
      dropletSize: resolvedPhysics.meanDropletRadius,
      precipitationRate: 0,
      thickness: resolvedPhysics.thickness,
      lifetime: 0,
      maxLifetime: 3600 + Math.random() * 7200, // 1-3 hours
      turbulence: resolvedPhysics.turbulentDiffusivity * this.config.turbulenceScale,
      updraftSpeed: resolvedPhysics.updraftSpeed * this.config.thermalUpdraftStrength,
      isPrecipitating: false,
      isEvaporating: false,
      events: [],
    };

    this.bodies.push(body);
    return body;
  }

  /** Create multiple clouds from weather conditions */
  spawnCloudsFromWeather(weather: { humidity: number; temperature: number; cloudCover: number; windSpeed: number; windDir: number }): void {
    if (!this.config.enableFormation) return;
    const numClouds = Math.floor(weather.cloudCover * 5); // 0-5 clouds per tick
    const baseAlt = 1000 + Math.random() * 4000;

    for (let i = 0; i < numClouds; i++) {
      const type = this.getCloudType(weather.humidity, weather.temperature, baseAlt + Math.random() * 2000);
      const pos = {
        x: (Math.random() - 0.5) * 50000,
        y: baseAlt + Math.random() * 2000,
        z: (Math.random() - 0.5) * 50000,
      };
      const wind = this.getWindAtAltitude(pos.y);
      const size = {
        width: 500 + Math.random() * 2000,
        height: 100 + Math.random() * 500,
        depth: 500 + Math.random() * 2000,
      };

      // Adjust size based on wind
      size.width += weather.windSpeed * 50;
      size.depth += weather.windSpeed * 50;

      this.spawnCloud(type, pos, size);
    }
  }

  /** Determine cloud type from weather conditions */
  private getCloudType(humidity: number, temperature: number, altitude: number): CloudType {
    if (humidity < this.config.formationHumidity) return CloudType.STRATUS;
    if (altitude > 6000) {
      if (temperature < 235) return CloudType.CIRRUS;
      return CloudType.ALTOCUMULUS;
    }
    if (altitude < 2000) {
      if (humidity > 0.95) return CloudType.CUMULONIMBUS;
      if (temperature < 275) return CloudType.STRATOCUMULUS;
      return CloudType.CUMULUS;
    }
    return CloudType.ALTOSTRATUS;
  }

  // ─── Cloud Physics Update ────────────────────────────────

  /** One cloud physics tick */
  updateCloud(dt: number, cloud: CloudBody): CloudBody[] {
    const events: CloudBody[] = [];
    const eventsThisStep: string[] = [];

    // 1. Wind-driven advection
    if (this.config.enableWindAdvection) {
      const wind = this.getWindAtAltitude(cloud.pos.y);
      cloud.windVel = wind;

      // Apply wind advection to cloud velocity
      const windScale = this.config.globalWindScale;
      cloud.vel.x += (wind.x * windScale - cloud.vel.x) * dt * 0.5;
      cloud.vel.z += (wind.z * windScale - cloud.vel.z) * dt * 0.5;
    }

    // 2. Turbulence
    if (this.config.enableTurbulence) {
      const turb = cloud.turbulence * this.config.turbulenceScale;
      const turbForce = 0.1 * turb * dt;
      cloud.vel.x += (Math.random() - 0.5) * turbForce * 2;
      cloud.vel.z += (Math.random() - 0.5) * turbForce * 2;
      cloud.vel.y += (Math.random() - 0.5) * turbForce;
    }

    // 3. Updraft (for convective clouds)
    if (cloud.updraftSpeed > 0) {
      cloud.vel.y += cloud.updraftSpeed * dt * this.config.thermalUpdraftStrength;
    }

    // 4. Gravity (droplet settling)
    const fallSpeed = cloud.physics.fallSpeed * (1 + cloud.dropletSize / 100);
    cloud.vel.y -= fallSpeed * dt;

    // 5. Altitude-coupled atmosphere
    if (this.config.useAltitudeCoupling) {
      const altDensity = altitudeDensity(cloud.pos.y);
      const dragCoeff = 0.5 * altDensity;
      const speed = Math.hypot(cloud.vel.x, cloud.vel.y, cloud.vel.z);
      if (speed > 1) {
        const drag = dragCoeff * speed * speed * 0.01 * dt;
        const k = Math.max(0, 1 - drag / speed);
        cloud.vel.x *= k;
        cloud.vel.y *= k;
        cloud.vel.z *= k;
      }
    }

    // 6. Position update
    cloud.pos.x += cloud.vel.x * dt;
    cloud.pos.y += cloud.vel.y * dt;
    cloud.pos.z += cloud.vel.z * dt;

    // 7. Cloud formation/dissipation
    if (this.config.enableFormation) {
      // Humidity check for formation/dissipation
      if (this.humidity < this.config.dissipationHumidity && cloud.lifetime > 300) {
        cloud.density -= dt * 0.005; // Faster dissipation
        cloud.isEvaporating = true;
        if (cloud.density <= 0) {
          this.dissipateCloud(cloud.id);
          return [];
        }
      } else if (this.humidity > this.config.formationHumidity) {
        cloud.density = Math.min(1, cloud.density + dt * 0.0005);
        cloud.isEvaporating = false;
      }
    }

    // 8. Precipitation physics
    if (this.config.enablePrecipitation) {
      const precip = this.computePrecipitation(cloud, dt);
      cloud.precipitationRate = precip.rate;
      cloud.isPrecipitating = precip.isPrecipitating;
      if (precip.rate > 0) {
        eventsThisStep.push(`${cloud.id} is precipitating at ${precip.rate.toFixed(1)} mm/h`);
      }
    }

    // 9. Temperature update (adiabatic cooling for rising clouds)
    if (cloud.vel.y > 0.5) {
      // Adiabatic lapse rate: ~9.8 K/km for dry air, ~6.5 K/km for moist
      const lapseRate = cloud.humidity > 0.8 ? 6.5 : 9.8;
      cloud.temperature -= lapseRate * (cloud.vel.y * dt) / 1000;
    }

    // 10. Ice formation at altitude
    if (cloud.pos.y > 4000 && cloud.physics.hasIce && cloud.temperature < 273.15) {
      const iceFraction = Math.max(0, 1 - (cloud.temperature - 230) / 43);
      cloud.iceContent = cloud.liquidWaterContent * iceFraction * 0.3;
      cloud.physics.fallSpeed = 0.5 + iceFraction; // Ice falls faster
    }

    // 11. Lifetime and aging
    cloud.lifetime += dt;
    if (cloud.lifetime > cloud.maxLifetime) {
      cloud.density -= dt * 0.002;
      if (cloud.density <= 0) {
        this.dissipateCloud(cloud.id);
        return [];
      }
    }

    // 12. Wind shear deformation (cloud shape changes)
    if (this.config.enableWindAdvection) {
      const wind = this.getWindAtAltitude(cloud.pos.y);
      const shear = Math.abs(wind.x - cloud.windVel.x);
      if (shear > 2) {
        // Elongate cloud in wind direction
        const stretchFactor = 1 + shear * 0.01 * dt;
        cloud.size.width *= stretchFactor;
        cloud.size.depth *= stretchFactor;
      }
    }

    // Emit events
    for (const ev of eventsThisStep) {
      cloud.events.push(ev);
    }

    return [cloud];
  }

  // ─── Precipitation Computation ───────────────────────────

  private computePrecipitation(cloud: CloudBody, dt: number): { rate: number; isPrecipitating: boolean } {
    if (!this.config.enablePrecipitation) return { rate: 0, isPrecipitating: false };

    const lwc = cloud.liquidWaterContent; // g/m³
    const ice = cloud.iceContent;
    const dropletSize = cloud.dropletSize;
    const fallSpeed = cloud.physics.fallSpeed;
    const efficiency = cloud.physics.precipEfficiency;

    // Autoconversion: cloud droplets → rain drops
    // When droplet concentration exceeds threshold, droplets coalesce
    if (lwc > this.config.precipThreshold && dropletSize > 20) {
      const autoconvRate = lwc * efficiency * dt * 0.001;
      cloud.precipitationRate = autoconvRate * 3600; // convert to mm/h per hour

      // Ice crystals fall and collect supercooled water (Bergeron process)
      if (cloud.physics.hasIce && ice > 0.1) {
        const bergeronRate = ice * 0.5 * dt;
        cloud.precipitationRate += bergeronRate * 3600;
      }

      // Snow vs rain based on temperature
      if (cloud.temperature < 273.15 && cloud.pos.y > 3000) {
        cloud.precipitationRate *= 0.8; // Snow reduces rain rate
      }

      return { rate: Math.max(0, cloud.precipitationRate), isPrecipitating: cloud.precipitationRate > 0.1 };
    }

    // Light precipitation from fog
    if (cloud.type === CloudType.FOG && lwc > 0.3) {
      const fogRate = lwc * 0.1 * dt;
      return { rate: fogRate * 3600, isPrecipitating: fogRate > 0.01 };
    }

    cloud.precipitationRate = 0;
    return { rate: 0, isPrecipitating: false };
  }

  // ─── Cloud Dissipation ──────────────────────────────────

  /** Remove a cloud body */
  private dissipateCloud(id: string): void {
    const idx = this.bodies.findIndex((b) => b.id === id);
    if (idx !== -1) {
      const cloud = this.bodies[idx];
      const ev = `${cloud.id} (${cloud.type}) dissipated after ${cloud.lifetime.toFixed(0)}s.`;
      cloud.events.push(ev);
      this.bodies.splice(idx, 1);
    }
  }

  // ─── Main Cloud Update ──────────────────────────────────

  /** Update all clouds for one tick */
  update(dt: number): CloudSimState {
    if (!this.config.enableClouds) return this.getState();

    const updatedClouds: CloudBody[] = [];
    const tickRate = this.config.cloudTickRate;
    const cloudDt = dt / tickRate;

    for (let i = 0; i < tickRate; i++) {
      for (const cloud of this.bodies) {
        const updated = this.updateCloud(cloudDt, cloud);
        updatedClouds.push(...updated);
      }
    }

    // Update time
    this.time += dt;

    // Update statistics
    const totalCloudCover = this.bodies.reduce((sum, c) => sum + c.density, 0);
    const precipitating = this.bodies.filter((c) => c.isPrecipitating).length;
    const evaporating = this.bodies.filter((c) => c.isEvaporating).length;
    const cloudMass = this.bodies.reduce((sum, c) => sum + c.liquidWaterContent + c.iceContent, 0);
    const totalPrecip = this.bodies.reduce((sum, c) => sum + c.precipitationRate, 0);

    this.cloudStats = {
      totalClouds: this.bodies.length,
      totalCloudCover: Math.min(1, totalCloudCover / Math.max(1, this.bodies.length)),
      precipitatingClouds: precipitating,
      evaporatingClouds: evaporating,
      cloudMass,
      precipitationRate: totalPrecip,
      stepCount: this.cloudStats.stepCount + 1,
    };

    return this.getState();
  }

  /** Get current simulation state */
  getState(): CloudSimState {
    return {
      time: this.time,
      bodies: [...this.bodies],
      windProfile: [...this.windProfile],
      humidity: this.humidity,
      temperature: this.temperature,
      pressure: this.pressure,
      precipitation: this.bodies
        .filter((b) => b.isPrecipitating)
        .map((b) => ({ type: b.type, rate: b.precipitationRate, intensity: b.density })),
      statistics: { ...this.cloudStats },
    };
  }

  /** Set weather conditions */
  setWeather(humidity: number, temperature: number, pressure: number): void {
    this.humidity = Math.max(0, Math.min(1, humidity));
    this.temperature = temperature;
    this.pressure = pressure;
  }

  /** Add cloud bodies from a weather snapshot */
  addCloudsFromWeather(weather: { cloudCover: number; humidity: number; temperature: number; windSpeed: number; windDir: number }): void {
    if (!this.config.enableFormation) return;
    const numClouds = Math.floor(weather.cloudCover * 8);
    const windRad = (weather.windDir * Math.PI) / 180;

    for (let i = 0; i < numClouds; i++) {
      const type = this.getCloudType(weather.humidity, weather.temperature, 1000 + Math.random() * 5000);
      const alt = 500 + Math.random() * 8000;
      const x = (Math.random() - 0.5) * 100000;
      const z = (Math.random() - 0.5) * 100000;

      const wind = this.getWindAtAltitude(alt);
      const body = this.spawnCloud(type, { x, y: alt, z });

      // Override velocity with wind + weather influence
      body.vel.x = wind.x * this.config.globalWindScale;
      body.vel.z = wind.z * this.config.globalWindScale;

      // Adjust size based on weather
      const sizeFactor = 0.5 + weather.humidity * 0.5;
      body.size.width *= sizeFactor;
      body.size.depth *= sizeFactor;

      // Adjust density based on cloud cover
      body.density = weather.cloudCover * (0.3 + Math.random() * 0.4);
    }
  }

  /** Get cloud data for rendering */
  getCloudRenderData(): Array<{
    id: string;
    type: CloudType;
    pos: { x: number; y: number; z: number };
    size: { width: number; height: number; depth: number };
    density: number;
    temperature: number;
    isPrecipitating: boolean;
    velocity: { x: number; y: number; z: number };
  }> {
    return this.bodies.map((b) => ({
      id: b.id,
      type: b.type,
      pos: { ...b.pos },
      size: { ...b.size },
      density: b.density,
      temperature: b.temperature,
      isPrecipitating: b.isPrecipitating,
      velocity: { ...b.vel },
    }));
  }

  /** Raycast through clouds to check visibility */
  raycastThroughClouds(origin: { x: number; y: number; z: number }, direction: { x: number; y: number; z: number }, maxDist: number = 50000): { hit: boolean; densityAtHit: number; cloudType?: CloudType } {
    let closestDensity = 0;
    let closestType: CloudType | undefined;
    let hit = false;

    for (const cloud of this.bodies) {
      // Check if ray intersects cloud bounding box
      const halfW = cloud.size.width / 2;
      const halfH = cloud.size.height / 2;
      const halfD = cloud.size.depth / 2;

      // Simple AABB intersection test
      const minX = cloud.pos.x - halfW, maxX = cloud.pos.x + halfW;
      const minY = cloud.pos.y - halfH, maxY = cloud.pos.y + halfH;
      const minZ = cloud.pos.z - halfD, maxZ = cloud.pos.z + halfD;

      // Ray-AABB intersection (simplified)
      const tNear = (minX - origin.x) / (direction.x || 1);
      const tFar = (maxX - origin.x) / (direction.x || 1);
      const tBottom = (minY - origin.y) / (direction.y || 1);
      const tTop = (maxY - origin.y) / (direction.y || 1);
      const tLeft = (minZ - origin.z) / (direction.z || 1);
      const tRight = (maxZ - origin.z) / (direction.z || 1);

      const tMin = Math.max(Math.min(tNear, tFar), Math.min(tBottom, tTop), Math.min(tLeft, tRight));
      const tMax = Math.min(Math.max(tNear, tFar), Math.max(tBottom, tTop), Math.max(tLeft, tRight));

      if (tMin <= tMax && tMin >= 0 && tMin < maxDist) {
        hit = true;
        const densityAtPoint = cloud.density * (1 - tMin / maxDist);
        if (densityAtPoint > closestDensity) {
          closestDensity = densityAtPoint;
          closestType = cloud.type;
        }
      }
    }

    return { hit, densityAtHit: closestDensity, cloudType: closestType };
  }
}

// ─── Cloud Factory for weather scenarios ───────────────────

export function createCloudFactory(config?: Partial<CloudConfig>): CloudPhysicsEngine {
  const engine = new CloudPhysicsEngine();
  if (config) {
    engine.config = { ...DEFAULT_CLOUD_CONFIG, ...config };
  }
  return engine;
}

// ─── Cloud Types List ──────────────────────────────────────

export const ALL_CLOUD_TYPES: CloudType[] = [
  CloudType.CIRRUS,
  CloudType.CIRROCUMULUS,
  CloudType.ALTOCUMULUS,
  CloudType.ALTOSTRATUS,
  CloudType.STRATUS,
  CloudType.STRATOCUMULUS,
  CloudType.CUMULUS,
  CloudType.CUMULONIMBUS,
  CloudType.NIMBOSTRATUS,
  CloudType.FOG,
];

export const CLOUD_TYPE_COLORS: Record<CloudType, string> = {
  [CloudType.CIRRUS]: "#ffffff",
  [CloudType.CIRROCUMULUS]: "#e8e8ff",
  [CloudType.ALTOCUMULUS]: "#d0d0d0",
  [CloudType.ALTOSTRATUS]: "#8a8a8a",
  [CloudType.STRATUS]: "#b0b0b0",
  [CloudType.STRATOCUMULUS]: "#9a9a9a",
  [CloudType.CUMULUS]: "#f0f0f0",
  [CloudType.CUMULONIMBUS]: "#4a4a4a",
  [CloudType.NIMBOSTRATUS]: "#5a5a5a",
  [CloudType.FOG]: "#c0c0c0",
};
