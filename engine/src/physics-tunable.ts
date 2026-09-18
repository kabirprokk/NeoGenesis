// Tunable physics parameters — gameplay-tuned constants that control
// simulation behavior. All values are documented and have sensible
// defaults. These can be adjusted per-environment or per-experience
// without touching the core physics formulas.

/** World simulation configuration */
export interface WorldConfig {
  /** Fixed timestep in seconds (default: 1/120) */
  fixedDt: number;
  /** Maximum number of substeps per frame for CCD */
  maxSubsteps: number;
  /** Maximum number of bodies in the world */
  maxBodies: number;
  /** Broad-phase optimization: cell size for spatial grid */
  spatialCellSize: number;
  /** Whether to enable broad-phase optimization */
  useBroadPhase: boolean;
  /** Sleep threshold: bodies below this speed are considered sleeping */
  sleepSpeedThreshold: number;
  /** Sleep timeout in seconds */
  sleepTimeoutSeconds: number;
  /** Maximum number of iterations per step for constraint solving */
  solverIterations: number;
  /** Error tolerance for constraint solving */
  solverTolerance: number;
  /** Whether to enable warm starting for solver */
  enableWarmStarting: boolean;
  /** Maximum linear correction for positional errors */
  maxLinearCorrection: number;
  /** Maximum angular correction for positional errors */
  maxAngularCorrection: number;
  /** Baumgarte stabilization factor */
  baumgarteFactor: number;
}

/** Default world configuration — tuned for 120 Hz simulation */
export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  fixedDt: 1 / 120,
  maxSubsteps: 32,
  maxBodies: 500,
  spatialCellSize: 5.0, // spatial grid cell size for broad-phase
  useBroadPhase: true,
  sleepSpeedThreshold: 0.15,
  sleepTimeoutSeconds: 2.0,
  solverIterations: 10,
  solverTolerance: 0.001,
  enableWarmStarting: true,
  maxLinearCorrection: 0.2,
  maxAngularCorrection: 0.05,
  baumgarteFactor: 0.2,
};

/** Gravity and environment tuning */
export interface GravityConfig {
  /** Gravity acceleration (m/s²) */
  gravity: number;
  /** Gravity at altitude scaling (real: g(h) = g0·(R/(R+h))²) */
  useAltitudeScaling: boolean;
  /** Wind vector (m/s) */
  windX: number;
  windY: number;
  windZ: number;
  /** Air density at sea level (kg/m³) */
  airDensity: number;
  /** Whether to use altitude-coupled air density */
  useAltitudeDensity: boolean;
}

/** Default gravity configuration — Earth surface */
export const DEFAULT_GRAVITY_CONFIG: GravityConfig = {
  gravity: 9.80665,
  useAltitudeScaling: true,
  windX: 0,
  windY: 0,
  windZ: 0,
  airDensity: 1.225,
  useAltitudeDensity: true,
};

/** Collision response tuning */
export interface CollisionTuning {
  /** Pair-averaged restitution for ground contacts */
  groundRestitution: number;
  /** Static friction coefficient for ground contacts */
  groundStaticFriction: number;
  /** Kinetic friction coefficient for ground contacts */
  groundKineticFriction: number;
  /** Resting contact friction kill threshold */
  restingFrictionThreshold: number;
  /** Rolling friction factor */
  rollingFrictionFactor: number;
  /** Minimum impact speed for collision events */
  impactEventThreshold: number;
  /** Impact cooldown between collisions on same pair (seconds) */
  impactCooldown: number;
  /** Maximum restitution for any pair (clamped) */
  maxRestitution: number;
  /** Minimum restitution for any pair */
  minRestitution: number;
}

/** Default collision tuning — gameplay-balanced */
export const DEFAULT_COLLISION_TUNING: CollisionTuning = {
  groundRestitution: 0.15,
  groundStaticFriction: 0.8,
  groundKineticFriction: 0.6,
  restingFrictionThreshold: 0.4,
  rollingFrictionFactor: 0.2,
  impactEventThreshold: 1.5,
  impactCooldown: 0.5,
  maxRestitution: 1.0,
  minRestitution: 0.0,
};

/** Drag and aerodynamic tuning */
export interface DragTuning {
  /** Enable transonic drag rise factor */
  enableTransonicDrag: boolean;
  /** Transonic bump amplification (Mach 1 area) */
  transonicAmplification: number;
  /** Supersonic drag plateau multiplier */
  supersonicPlateau: number;
  /** Subsonic drag factor */
  subsonicDragFactor: number;
  /** Magnus lift enable flag */
  enableMagnusLift: boolean;
  /** Magnus lift maximum coefficient (clamped) */
  maxMagnusCl: number;
  /** Magnus lift sensitivity */
  magnusSensitivity: number;
}

/** Default drag tuning */
export const DEFAULT_DRAG_TUNING: DragTuning = {
  enableTransonicDrag: true,
  transonicAmplification: 0.9,
  supersonicPlateau: 1.25,
  subsonicDragFactor: 1.0,
  enableMagnusLift: true,
  maxMagnusCl: 0.5,
  magnusSensitivity: 0.12,
};

/** Thermal simulation tuning */
export interface ThermalTuning {
  /** Convection coefficient for still air (W/m²·K) */
  stillAirConvection: number;
  /** Convection coefficient for water bath (W/m²·K) */
  waterBathConvection: number;
  /** Convection coefficient for lava bath (W/m²·K) */
  lavaBathConvection: number;
  /** Thermal radiation enable flag */
  enableRadiation: boolean;
  /** Stefan-Boltzmann constant (W/m²·K⁴) */
  stefanBoltzmann: number;
  /** Thermal update interval (seconds) */
  thermalUpdateInterval: number;
}

/** Default thermal tuning */
export const DEFAULT_THERMAL_TUNING: ThermalTuning = {
  stillAirConvection: 10,
  waterBathConvection: 800,
  lavaBathConvection: 500,
  enableRadiation: true,
  stefanBoltzmann: 5.670374419e-8,
  thermalUpdateInterval: 0.008,
};

/** Fluid simulation tuning */
export interface FluidTuning {
  /** Enable buoyancy forces */
  enableBuoyancy: boolean;
  /** Enable viscous damping in fluids */
  enableViscousDamping: boolean;
  /** Viscosity damping multiplier */
  viscosityMultiplier: number;
  /** Submersion precision (how many sub-steps for submersion check) */
  submersionPrecision: number;
  /** Splash detection threshold (m/s) */
  splashThreshold: number;
  /** Fluid surface detection range */
  surfaceDetectionRange: number;
}

/** Default fluid tuning */
export const DEFAULT_FLUID_TUNING: FluidTuning = {
  enableBuoyancy: true,
  enableViscousDamping: true,
  viscosityMultiplier: 6.0,
  submersionPrecision: 4,
  splashThreshold: 1.5,
  surfaceDetectionRange: 2.0,
};

/** Structural failure tuning */
export interface StructuralTuning {
  /** Enable fracture/shatter mechanics */
  enableFracture: boolean;
  /** Pressure spread factor for brittle materials (0-1) */
  brittleSpreadFactor: number;
  /** Sphere fracture spread factor */
  sphereSpreadFactor: number;
  /** Box fracture spread factor */
  boxSpreadFactor: number;
  /** Minimum impact energy for structural damage (J) */
  minImpactEnergy: number;
  /** Damage multiplier for impact forces */
  damageMultiplier: number;
  /** Enable melt-on-contact */
  enableMelting: boolean;
  /** Enable ignition-on-contact */
  enableIgnition: boolean;
}

/** Default structural tuning */
export const DEFAULT_STRUCTURAL_TUNING: StructuralTuning = {
  enableFracture: true,
  brittleSpreadFactor: 0.007,
  sphereSpreadFactor: 0.002,
  boxSpreadFactor: 0.1,
  minImpactEnergy: 0.5,
  damageMultiplier: 1.0,
  enableMelting: true,
  enableIgnition: true,
};

/** Sleep and optimization tuning */
export interface SleepTuning {
  /** Enable body sleeping for performance */
  enableSleep: boolean;
  /** Speed threshold for sleep (m/s) */
  speedThreshold: number;
  /** Time threshold for sleep (seconds) */
  timeThreshold: number;
  /** Wake up on collision */
  wakeOnCollision: boolean;
  /** Wake up on force application */
  wakeOnForce: boolean;
  /** Maximum sleeping bodies before force-wake others */
  maxSleepingBodies: number;
}

/** Default sleep tuning */
export const DEFAULT_SLEEP_TUNING: SleepTuning = {
  enableSleep: true,
  speedThreshold: 0.15,
  timeThreshold: 2.0,
  wakeOnCollision: true,
  wakeOnForce: true,
  maxSleepingBodies: 400,
};

/** Combined physics configuration — all tuning in one place */
export interface PhysicsConfig {
  world: WorldConfig;
  gravity: GravityConfig;
  collision: CollisionTuning;
  drag: DragTuning;
  thermal: ThermalTuning;
  fluid: FluidTuning;
  structural: StructuralTuning;
  sleep: SleepTuning;
}

/** Complete default physics configuration */
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  world: DEFAULT_WORLD_CONFIG,
  gravity: DEFAULT_GRAVITY_CONFIG,
  collision: DEFAULT_COLLISION_TUNING,
  drag: DEFAULT_DRAG_TUNING,
  thermal: DEFAULT_THERMAL_TUNING,
  fluid: DEFAULT_FLUID_TUNING,
  structural: DEFAULT_STRUCTURAL_TUNING,
  sleep: DEFAULT_SLEEP_TUNING,
};

/** Deep-partial: environment presets override nested tuning field-by-field. */
export type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

/** Environment presets with tuned physics */
export const ENV_PRESETS: Record<string, DeepPartial<PhysicsConfig>> = {
  vacuum: {
    gravity: { gravity: 0, airDensity: 0, useAltitudeDensity: false },
    drag: { enableTransonicDrag: false, enableMagnusLift: false },
    fluid: { enableBuoyancy: false, enableViscousDamping: false },
    thermal: { stillAirConvection: 0 },
  },
  mars: {
    gravity: { gravity: 3.72076, airDensity: 0.020, useAltitudeDensity: true },
    drag: { enableTransonicDrag: true, enableMagnusLift: true },
    fluid: { enableBuoyancy: false },
    thermal: { stillAirConvection: 5 },
  },
  underwater: {
    gravity: { gravity: 9.80665, airDensity: 0, useAltitudeDensity: false },
    fluid: {
      enableBuoyancy: true,
      enableViscousDamping: true,
      viscosityMultiplier: 10.0,
      splashThreshold: 0.5,
    },
    thermal: { stillAirConvection: 200, waterBathConvection: 800 },
    drag: { subsonicDragFactor: 0.5 },
  },
  low_gravity: {
    gravity: { gravity: 1.62, airDensity: 1.225 },
    collision: { groundRestitution: 0.6, groundStaticFriction: 0.5, groundKineticFriction: 0.3 },
    drag: { enableTransonicDrag: false },
  },
  high_gravity: {
    gravity: { gravity: 24.79, airDensity: 1.225 },
    collision: { groundRestitution: 0.05, groundStaticFriction: 1.5, groundKineticFriction: 1.2 },
    drag: { subsonicDragFactor: 2.0 },
  },
};
