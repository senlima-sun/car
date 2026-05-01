/**
 * TypeScript bridge for Rust/WASM physics engine
 */

import init, { PhysicsEngine, TireCompound, SurfaceType } from './pkg/car_physics_engine'
import { incrementWasmCalls } from '../debug/perfCounters'
import { publishStepBundle } from './stepBundleSnapshot'
import { IS_DEV } from '../utils/isDev'

function recordWasmCall(): void {
  incrementWasmCalls(1)
}

// Re-export types for convenience
export { TireCompound, SurfaceType }

// ============================================================================
// Type Definitions
// ============================================================================

export interface CarInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  brake: boolean
  handbrake: boolean
  steer?: number
  throttle?: number
  brake_analog?: number
}

export interface PerWheelWear {
  front_left: number
  front_right: number
  rear_left: number
  rear_right: number
}

export interface GripBreakdown {
  base_compound_grip: number
  weather_friction_mult: number
  tire_wear_grip_mult: number
  surface_grip_mult: number
  curb_turn_grip_mult: number
  tire_temp_grip_mult: number
  aquaplaning_grip_mult: number
  thermal_shock_grip_mult: number
  final_effective_grip: number
}

export interface TireMaterialOutput {
  per_wheel_graining: [number, number, number, number]
  per_wheel_blistering: [number, number, number, number]
  per_wheel_viscoelastic_grip: [number, number, number, number]
  per_wheel_shore_hardness: [number, number, number, number]
}

export interface SurfaceFrictionBreakdown {
  water_film_mm: number
  ice_thickness: number
  snow_depth: number
  base_mu: number
  effective_mu: number
}

export interface CarPhysicsOutput {
  linear_velocity: [number, number, number]
  angular_velocity: [number, number, number]
  speed_kmh: number
  forward_speed_ms: number
  gear: number
  rpm: number
  current_gear_ratio: number
  slip_angle: number
  is_drifting: boolean
  effective_grip: number
  lateral_g: number
  longitudinal_g: number
  skid_intensity: number
  tire_wear: PerWheelWear
  steer_angle: number
  temperature: TemperatureOutput
  aquaplaning: AquaplaningState
  tire_thermal_shock: TireThermalShock
  ers: ErsState
  active_aero: ActiveAeroState
  grip_breakdown: GripBreakdown
  tire_material: TireMaterialOutput
  downforce_newtons: number
  per_wheel_forces: PerWheelForces
  boost_pressure_bar: number
}

/**
 * Per-corner tire-force telemetry. Wave 3 surfaces this so the G-method,
 * ride-height aero, and grip-stack unification changes are observable from
 * tests and the dev panel without inspecting integrator internals. Wheel
 * order: [FL, FR, RL, RR]. Pre-Phase-1, all arrays are zero-default; from
 * Phase 1 the integrator populates them each step.
 */
export interface PerWheelForces {
  fx: [number, number, number, number]
  fy: [number, number, number, number]
  fz: [number, number, number, number]
  slip_angle: [number, number, number, number]
  slip_ratio: [number, number, number, number]
}

export interface WeatherModifiers {
  friction_slip_multiplier: number
  drag_multiplier: number
  downforce_multiplier: number
  engine_efficiency_multiplier: number
  brake_efficiency_multiplier: number
  steer_response_multiplier: number
  max_steer_angle_multiplier: number
  drift_entry_slip_angle_multiplier: number
  drift_lateral_correction_multiplier: number
  max_speed_multiplier: number
}

export interface SurfaceModifiers {
  grip_multiplier: number
  speed_multiplier: number
  tire_wear_multiplier: number
  drag_multiplier: number
  brake_efficiency: number
  steer_response: number
}

export interface AmbientConditions {
  /** Temperature in normalized scale (0.0 = -20C, 1.0 = 50C) */
  temperature: number
  /** Humidity 0.0 to 1.0 (0% to 100%) */
  humidity: number
  /** Rain intensity 0.0 to 1.0 (0% to 100%) */
  rain_intensity: number
}

// ============================================================================
// Wind Types
// ============================================================================

/** Wind state from physics engine */
export interface WindState {
  /** Wind direction in radians (0 = +X axis, π/2 = +Z axis) */
  direction: number
  /** Base wind speed in m/s (player-set value) */
  base_speed: number
  /** Current wind speed with gusts applied */
  current_speed: number
  /** Gust intensity multiplier (0.0 to 1.0) */
  gust_intensity: number
  /** Internal timer for gust calculations */
  gust_timer: number
  /** Whether wind system is enabled */
  enabled: boolean
}

/** Wind physics modifiers relative to car heading */
export interface WindModifiers {
  /** Drag modifier based on headwind/tailwind (>1 = more drag, <1 = less drag) */
  drag_modifier: number
  /** Lateral force from crosswind in Newtons */
  lateral_force: number
  /** Steering difficulty multiplier (0.0-1.0, lower = harder to steer) */
  steering_difficulty: number
  /** Cooling multiplier for heat dissipation (>1 = faster cooling) */
  cooling_multiplier: number
  /** Headwind component in m/s (positive = against car) */
  headwind_component: number
  /** Crosswind component in m/s (positive = from right) */
  crosswind_component: number
}

// ============================================================================
// Temperature Types
// ============================================================================

/** Engine temperature state */
export interface EngineTemperature {
  /** Current engine temperature (0.0 = cold/20C, 1.0 = critical/160C) */
  temperature: number
  /** Is engine in overheating state */
  is_overheating: boolean
  /** Power reduction due to temperature (1.0 = full power, 0.5 = 50% power) */
  power_multiplier: number
}

/** Per-wheel tire temperature data (inner and outer edge) */
export interface PerWheelTemperature {
  front_left_inner: number
  front_left_outer: number
  front_right_inner: number
  front_right_outer: number
  rear_left_inner: number
  rear_left_outer: number
  rear_right_inner: number
  rear_right_outer: number
}

/** Full temperature output for UI */
export interface TemperatureOutput {
  engine: EngineTemperature
  tires: PerWheelTemperature
  /** Per-wheel grip multiplier from temperature (0.0-1.0) */
  tire_temp_grip: [number, number, number, number]
  /** Per-wheel "in optimal window" status */
  tire_in_window: [boolean, boolean, boolean, boolean]
  /** Per-wheel blowout risk (0.0 = safe, 1.0 = burst) */
  tire_blowout_risk: [number, number, number, number]
  /** Per-wheel "tire has burst from heat" latched state */
  tire_blown: [boolean, boolean, boolean, boolean]
  /** Engine seize risk (0.0 = healthy, 1.0 = seized) */
  engine_seize_risk: number
  /** Engine has catastrophically failed */
  engine_seized: boolean
}

// ============================================================================
// ERS (Energy Recovery System) Types - 2026 F1 Regulations
// ============================================================================

export type ErsMode = 'Balanced' | 'Attack' | 'Harvest' | 'Overtake' | 'SemiAuto'

/** Source of energy harvesting (2026 ERS) */
export type HarvestSource = 'None' | 'Braking' | 'Coast' | 'SuperClip'

/** Semi-Auto ERS preset profiles */
export type SemiAutoPreset = 'Balanced' | 'Aggressive' | 'Conservative'

/** Semi-Auto configuration for target-based battery management */
export interface SemiAutoConfig {
  /** Minimum target battery level (0.0-1.0) */
  target_min: number
  /** Maximum target battery level (0.0-1.0) */
  target_max: number
  /** Current preset */
  preset: SemiAutoPreset
  /** Lap mode enabled (race-aware strategy) */
  lap_mode: boolean
  /** Expert mode (disables semi-auto, full manual) */
  expert_mode: boolean
}

/** Semi-Auto output state (for UI feedback) */
export interface SemiAutoState {
  /** Whether coast regeneration is recommended right now */
  coast_recommended: boolean
  /** Coast benefit score (0.0-1.0, how beneficial lifting would be) */
  coast_benefit: number
  /** Current deploy efficiency based on speed (0.0-1.0) */
  deploy_efficiency: number
  /** Is battery in critical state (<15%) */
  is_critical: boolean
  /** Active deploy multiplier being applied */
  effective_deploy_mult: number
  /** Active harvest multiplier being applied */
  effective_harvest_mult: number
}

export interface ErsState {
  battery_charge: number // 0.0-1.0
  mode: ErsMode
  power_flow: number // kW (positive=deploy, negative=harvest)
  is_deploying: boolean
  is_harvesting: boolean
  // 2026 ERS fields
  super_clip_active: boolean // True when harvesting at full throttle
  harvest_source: HarvestSource
  overtake_available: boolean // True when in testing mode
  // Semi-Auto mode state
  semi_auto: SemiAutoState
  /** Megajoules recovered this lap (regulation cap: 8.5 MJ). */
  lap_recovered_mj: number
  /** Megajoules deployed this lap. */
  lap_deployed_mj: number
  /** Whether the 8.5 MJ per-lap recovery cap has been hit. */
  lap_recovery_cap_reached: boolean
}

// ============================================================================
// Aquaplaning and Thermal Shock Types
// ============================================================================

/** Aquaplaning state when driving through deep standing water */
export interface AquaplaningState {
  /** Whether the car is currently aquaplaning */
  is_aquaplaning: boolean
  /** Intensity of aquaplaning (0.0-1.0) */
  intensity: number
  /** Which wheels are affected [FL, FR, RL, RR] */
  affected_wheels: [boolean, boolean, boolean, boolean]
}

/** Tire thermal shock state from sudden cooling in puddles */
export interface TireThermalShock {
  /** Whether any tire is in thermal shock */
  is_shocked: boolean
  /** Grip penalty multiplier (0.0-0.3, where 0.3 = 30% grip loss) */
  grip_penalty: number
  /** Time remaining for recovery (seconds) */
  recovery_time: number
}

// ============================================================================
// Active Aero Types
// ============================================================================

export type AeroMode = 'Corner' | 'Straight' | 'Drs'

export interface ActiveAeroState {
  mode: AeroMode
  front_wing_angle: number // 0.0-1.0
  rear_wing_angle: number // 0.0-1.0
  drag_multiplier: number
  /** Combined (axle-averaged) downforce multiplier. Telemetry/UI only. */
  downforce_multiplier: number
  /** Wave 3 Phase 4: front-axle downforce multiplier. DRS keeps this high. */
  front_downforce_multiplier: number
  /** Wave 3 Phase 4: rear-axle downforce multiplier. DRS drops this sharply. */
  rear_downforce_multiplier: number
  auto_mode: boolean
  /** Whether the car is inside a DRS zone. */
  drs_zone_active: boolean
  /** Whether DRS is currently deployed. */
  drs_enabled: boolean
}

// ============================================================================
// Brake System Types
// ============================================================================

export type EngineBrakingLevel = 'Low' | 'Medium' | 'High'

export interface BrakeState {
  front_bias: number // 0.50-0.70
  engine_braking: EngineBrakingLevel
  front_brake_force: number // N
  rear_brake_force: number // N
}

export type TerrainMaterial =
  | 'Asphalt'
  | 'Concrete'
  | 'Grass'
  | 'Gravel'
  | 'Sand'
  | 'Dirt'
  | 'Mud'
  | 'Ice'
  | 'Snow'
  | 'Kerb'
  | 'AstroTurf'

export interface TerrainMaterialProperties {
  grip_coefficient: number
  roughness_factor: number
  thermal_conductivity: number
  tire_wear_rate: number
  drag_multiplier: number
  rolling_resistance: number
}

export interface TerrainQueryResult {
  height: number
  material: TerrainMaterial
  properties: TerrainMaterialProperties
  roughness: number
  normal: [number, number, number]
}

export interface PerWheelTerrain {
  heights: [number, number, number, number]
  materials: [string, string, string, string]
  grip_multipliers: [number, number, number, number]
  roughness: [number, number, number, number]
  bump_forces: [number, number, number, number]
}

export interface BottomingOutState {
  is_contact: boolean
  scrape_intensity: number
  drag_force: number
}

export interface StepAndSyncOutput {
  physics: CarPhysicsOutput
  wind_state: WindState
  aero_state: ActiveAeroState
  brake_state: BrakeState
  brake_disc_temps_celsius: [number, number, number, number]
  brake_fade: number
  input_throttle: number
  input_brake: number
  input_steer: number
  ambient: AmbientConditions
  world_downforce: [number, number, number]
}

// ============================================================================
// Engine Instance Management
// ============================================================================

let engine: PhysicsEngine | null = null
let initialized = false
let initializing: Promise<void> | null = null

/**
 * Initialize the WASM physics engine
 * Safe to call multiple times - will only initialize once
 */
export async function initPhysicsEngine(): Promise<void> {
  if (initialized) return

  if (initializing) {
    await initializing
    return
  }

  initializing = (async () => {
    try {
      await init({ module_or_path: '/src/wasm/pkg/car_physics_engine_bg.wasm' })
      engine = new PhysicsEngine()
      initialized = true
      console.log('[PhysicsBridge] WASM physics engine initialized')
    } catch (error) {
      console.error('[PhysicsBridge] Failed to initialize WASM physics engine:', error)
      throw error
    }
  })()

  await initializing
}

/**
 * Get the physics engine instance
 * Throws if not initialized
 */
export function getPhysicsEngine(): PhysicsEngine {
  if (!engine) {
    throw new Error('Physics engine not initialized. Call initPhysicsEngine() first.')
  }
  return engine
}

/**
 * Check if the physics engine is initialized
 */
export function isPhysicsEngineInitialized(): boolean {
  return initialized && engine !== null
}

// ============================================================================
// Type-Safe Wrapper Functions
// ============================================================================

const sanitizeWarnedKeys = new Set<string>()

/**
 * Sanitize a number value - replace NaN/Infinity with fallback.
 * Wave 2 Phase 1 closed the three known Rust-side NaN sources (acos/asin
 * input clamps in mod.rs and sigma_sq guard in tires.rs). Any NaN reaching
 * here in dev is a real bug; warn once per call-site key and fall back.
 */
function sanitize(value: number, fallback: number = 0, key?: string): number {
  if (Number.isFinite(value)) return value
  if (IS_DEV && key && !sanitizeWarnedKeys.has(key)) {
    sanitizeWarnedKeys.add(key)
    console.warn(
      `[PhysicsBridge] sanitize fallback fired at "${key}" (got ${value}); replacing with ${fallback}. This indicates a Rust-side NaN root cause that should be fixed.`,
    )
  }
  return fallback
}

/**
 * Sanitize a 3D vector
 */
function sanitizeVec3(
  vec: [number, number, number],
  fallback: [number, number, number] = [0, 0, 0],
  key?: string,
): [number, number, number] {
  return [
    sanitize(vec[0], fallback[0], key ? `${key}.x` : undefined),
    sanitize(vec[1], fallback[1], key ? `${key}.y` : undefined),
    sanitize(vec[2], fallback[2], key ? `${key}.z` : undefined),
  ]
}

const WHEEL_LOADS_MIN_TOTAL_N = 1

function sanitizeWheelLoads(
  loads: [number, number, number, number] | undefined,
): [number, number, number, number] | null {
  if (!loads) return null
  if (!Number.isFinite(loads[0]) || !Number.isFinite(loads[1])
      || !Number.isFinite(loads[2]) || !Number.isFinite(loads[3])) {
    return null
  }
  const fl = loads[0] > 0 ? loads[0] : 0
  const fr = loads[1] > 0 ? loads[1] : 0
  const rl = loads[2] > 0 ? loads[2] : 0
  const rr = loads[3] > 0 ? loads[3] : 0
  if (fl + fr + rl + rr < WHEEL_LOADS_MIN_TOTAL_N) return null
  // Fresh tuple per call: serde-wasm-bindgen serializes synchronously, but
  // returning a shared scratch buffer would alias if FFI ever batches or
  // multiple callers run in one tick (e.g., a future ghost-replay path).
  return [fl, fr, rl, rr]
}

/**
 * Run a single physics step. Wave 2: routes through `stepAndSync` and
 * extracts `.physics` so the legacy `eng.step` WASM export has no live
 * caller and gets dead-code-eliminated by LTO in release.
 */
export function stepPhysics(
  delta: number,
  input: CarInput,
  position: [number, number, number],
  rotation: [number, number, number, number],
  linvel: [number, number, number],
  angvel: [number, number, number],
  surfaceNormal: [number, number, number] = [0, 1, 0],
  wheelLoads?: [number, number, number, number],
): CarPhysicsOutput {
  return stepAndSync(
    delta,
    input,
    position,
    rotation,
    linvel,
    angvel,
    surfaceNormal,
    wheelLoads,
  ).physics
}

/**
 * Combined physics step + state sync (fewer FFI calls).
 * Wave 2 Phase 3: payload is packed into a single shared Float32Array
 * and CarInput booleans into a u32 bitfield, replacing 6 separate
 * `serde_wasm_bindgen::from_value` calls per frame with one slice
 * borrow on the Rust side. Single-owner buffer; safe under the current
 * sequential 120Hz game loop. A future ghost-replay path that calls
 * `stepAndSync` twice per frame would need its own scratch.
 *
 * Wave 3 Phase 3: payload extended from 25 to 27 floats — slots
 * [25] = front_axle_ride_height_m and [26] = rear_axle_ride_height_m.
 * Defaults to RIDE_HEIGHT_OPTIMAL_M (0.035) so a cold-cache call
 * produces ground-effect multiplier = 1.0 (Wave 2 behaviour).
 */
const RIDE_HEIGHT_OPTIMAL_M = 0.035
const stepPackedBuffer = new Float32Array(27)

function sanitizeRideHeight(value: number): number {
  if (Number.isFinite(value)) {
    return Math.min(0.5, Math.max(0.0, value))
  }
  return RIDE_HEIGHT_OPTIMAL_M
}

export function stepAndSync(
  delta: number,
  input: CarInput,
  position: [number, number, number],
  rotation: [number, number, number, number],
  linvel: [number, number, number],
  angvel: [number, number, number],
  surfaceNormal: [number, number, number] = [0, 1, 0],
  wheelLoads?: [number, number, number, number],
  axleRideHeights?: [number, number],
): StepAndSyncOutput {
  const eng = getPhysicsEngine()
  const safeLinvel = sanitizeVec3(linvel, undefined, 'linvel')
  const safeAngvel = sanitizeVec3(angvel, undefined, 'angvel')
  const safePosition = sanitizeVec3(position, undefined, 'position')
  const safeNormal = sanitizeVec3(surfaceNormal, [0, 1, 0], 'surfaceNormal')
  const safeDelta = sanitize(delta, 0.016)
  const safeLoads = sanitizeWheelLoads(wheelLoads)

  const buf = stepPackedBuffer
  buf[0] = safeDelta
  buf[1] = sanitize(input.throttle ?? 0, 0)
  buf[2] = sanitize(input.steer ?? 0, 0)
  buf[3] = sanitize(input.brake_analog ?? 0, 0)
  buf[4] = 0
  buf[5] = safePosition[0]; buf[6] = safePosition[1]; buf[7] = safePosition[2]
  // Rotation: pre-existing serde path validated via from_value; the packed
  // path bypasses that, so sanitize per-component to avoid a non-finite
  // quaternion poisoning the physics step.
  buf[8] = sanitize(rotation[0], 0, 'rotation.x')
  buf[9] = sanitize(rotation[1], 0, 'rotation.y')
  buf[10] = sanitize(rotation[2], 0, 'rotation.z')
  buf[11] = sanitize(rotation[3], 1, 'rotation.w')
  buf[12] = safeLinvel[0]; buf[13] = safeLinvel[1]; buf[14] = safeLinvel[2]
  buf[15] = safeAngvel[0]; buf[16] = safeAngvel[1]; buf[17] = safeAngvel[2]
  buf[18] = safeNormal[0]; buf[19] = safeNormal[1]; buf[20] = safeNormal[2]
  if (safeLoads) {
    buf[21] = safeLoads[0]; buf[22] = safeLoads[1]; buf[23] = safeLoads[2]; buf[24] = safeLoads[3]
  } else {
    buf[21] = 0; buf[22] = 0; buf[23] = 0; buf[24] = 0
  }
  // Wave 3 Phase 3: per-axle ride heights. Cold-cache or omitted →
  // RIDE_HEIGHT_OPTIMAL_M (0.035) so ground-effect multiplier = 1.0
  // (Wave 2 behaviour preserved for callers that haven't wired
  // suspension forwarding yet — Step 3.4 wires the canonical caller).
  buf[25] = sanitizeRideHeight(axleRideHeights ? axleRideHeights[0] : RIDE_HEIGHT_OPTIMAL_M)
  buf[26] = sanitizeRideHeight(axleRideHeights ? axleRideHeights[1] : RIDE_HEIGHT_OPTIMAL_M)

  const inputBits =
    (input.forward ? 0b0000_0001 : 0) |
    (input.backward ? 0b0000_0010 : 0) |
    (input.left ? 0b0000_0100 : 0) |
    (input.right ? 0b0000_1000 : 0) |
    (input.brake ? 0b0001_0000 : 0) |
    (input.handbrake ? 0b0010_0000 : 0)
  const result = eng.step_and_sync_packed(buf, inputBits) as StepAndSyncOutput

  recordWasmCall()
  publishStepBundle(result)
  return result
}

/**
 * Get current weather modifiers
 */
export function getWeatherModifiers(): WeatherModifiers {
  return getPhysicsEngine().get_weather_modifiers() as WeatherModifiers
}

/**
 * Get current ambient conditions (temperature and humidity)
 */
export function getAmbientConditions(): AmbientConditions {
  return getPhysicsEngine().get_ambient_conditions() as AmbientConditions
}

/**
 * Set weather conditions
 * @param celsius Temperature in Celsius (-10 to 50)
 * @param humidity Humidity 0.0 to 1.0 (0% to 100%)
 * @param rainIntensity Rain intensity 0.0 to 1.0 (0% to 100%)
 */
export function setCustomWeather(celsius: number, humidity: number, rainIntensity: number): void {
  getPhysicsEngine().set_custom_weather(celsius, humidity, rainIntensity)
}

/**
 * Get current rain intensity (0.0 to 1.0)
 */
export function getRainIntensity(): number {
  return getPhysicsEngine().get_rain_intensity()
}

/**
 * Set environment with full continuous parameters
 * @param celsius Temperature in Celsius
 * @param humidity Humidity 0.0 to 1.0
 * @param precipitationRateMmh Precipitation rate in mm/h (0-50)
 * @param pressureHpa Atmospheric pressure in hPa (default 1013.25)
 * @param cloudCover Cloud cover 0.0 to 1.0
 */
export function setEnvironment(
  celsius: number,
  humidity: number,
  precipitationRateMmh: number,
  pressureHpa: number,
  cloudCover: number,
): void {
  getPhysicsEngine().set_environment(
    celsius,
    humidity,
    precipitationRateMmh,
    pressureHpa,
    cloudCover,
  )
}

/**
 * Get current air density (kg/m³)
 */
export function getAirDensity(): number {
  return getPhysicsEngine().get_air_density()
}

/**
 * Get surface friction breakdown
 */
export function getSurfaceFrictionBreakdown(): SurfaceFrictionBreakdown {
  return getPhysicsEngine().get_surface_friction_breakdown() as SurfaceFrictionBreakdown
}

// ============================================================================
// Wind API
// ============================================================================

/**
 * Set wind parameters
 * @param direction Wind direction in radians (0 = +X axis, π/2 = +Z axis)
 * @param speed Wind speed in m/s (0-25 range)
 */
export function setWind(direction: number, speed: number): void {
  getPhysicsEngine().set_wind(direction, speed)
}

/**
 * Enable or disable wind system
 */
export function setWindEnabled(enabled: boolean): void {
  getPhysicsEngine().set_wind_enabled(enabled)
}

/**
 * Check if wind system is enabled
 */
export function isWindEnabled(): boolean {
  return getPhysicsEngine().is_wind_enabled()
}

/**
 * Get current wind state
 */
export function getWindState(): WindState {
  return getPhysicsEngine().get_wind_state() as WindState
}

/**
 * Get current wind modifiers relative to car heading
 * @param carHeading Car heading in radians
 * @param carSpeed Car speed in m/s
 */
export function getWindModifiers(carHeading: number, carSpeed: number): WindModifiers {
  return getPhysicsEngine().get_wind_modifiers(carHeading, carSpeed) as WindModifiers
}

// ============================================================================
// Tire API
// ============================================================================

/**
 * Set tire compound
 */
export function setTireCompound(compound: TireCompound): void {
  getPhysicsEngine().set_tire_compound(compound)
}

/**
 * Get current tire compound
 */
export function getTireCompound(): TireCompound {
  return getPhysicsEngine().get_tire_compound()
}

/**
 * Get tire wear (0.0 to 1.0)
 */
export function getTireWear(): number {
  return getPhysicsEngine().get_tire_wear()
}

/**
 * Reset tire wear
 */
export function resetTireWear(): void {
  getPhysicsEngine().reset_tire_wear()
}

/**
 * Clear blown-tire latch and per-wheel blowout risk.
 * Call from respawn lifecycle paths so heat-blown tires don't persist.
 */
export function resetTireBlowout(): void {
  getPhysicsEngine().reset_tire_blowout()
}

/**
 * Set tire wear for all wheels (for debug/testing)
 * @param wearPercentage Wear percentage 0-100 (0 = new, 100 = fully worn)
 */
export function setTireWear(wearPercentage: number): void {
  const clamped = Math.max(0, Math.min(100, wearPercentage))
  getPhysicsEngine().set_tire_wear(clamped / 100)
}

/**
 * Get effective grip (compound * weather * wear)
 */
export function getEffectiveGrip(): number {
  return getPhysicsEngine().get_effective_grip()
}

/**
 * Intake-manifold boost pressure in bar absolute (atmospheric = 1.0,
 * full boost ≈ 4.8). Sanitised to atmospheric on NaN/Infinity.
 */
export function getBoostPressureBar(): number {
  const value = getPhysicsEngine().get_boost_pressure_bar()
  return Number.isFinite(value) ? value : 1.0
}

/**
 * Get per-wheel tire wear (0.0 to 1.0 per wheel)
 */
export function getTireWearPerWheel(): PerWheelWear {
  return getPhysicsEngine().get_tire_wear_per_wheel() as PerWheelWear
}

/**
 * Set curb contact state. Routes through the numeric-enum FFI variant
 * (Wave 2 Phase 4) so the per-call boundary doesn't allocate strings.
 * `curbType` is the lowercase `CurbType` union from src/types/trackObjects.
 */
export function setOnCurb(
  isOnCurb: boolean,
  side?: 'left' | 'right',
  curbType?: 'apex' | 'exit' | 'flat',
): void {
  const sideCode = side === 'left' ? 1 : side === 'right' ? 2 : 0
  const curbCode = curbType === 'exit' ? 1 : curbType === 'flat' ? 2 : 0
  getPhysicsEngine().set_on_curb_numeric(isOnCurb, sideCode, curbCode)
}

/**
 * Check if car is on curb
 */
export function isOnCurb(): boolean {
  return getPhysicsEngine().is_on_curb()
}

/**
 * Set current surface type (grass, road, curb)
 */
export function setSurface(surface: SurfaceType): void {
  getPhysicsEngine().set_surface(surface)
}

/**
 * Get current surface type
 */
export function getSurface(): SurfaceType {
  return getPhysicsEngine().get_surface()
}

/**
 * Check if car is on road
 */
export function isOnRoad(): boolean {
  return getPhysicsEngine().is_on_road()
}

/**
 * Check if car is off-track (on grass)
 */
export function isOffTrack(): boolean {
  return getPhysicsEngine().is_off_track()
}

/**
 * Get current surface modifiers
 */
export function getSurfaceModifiers(): SurfaceModifiers {
  return getPhysicsEngine().get_surface_modifiers() as SurfaceModifiers
}

/**
 * Get number of active track temperature cells
 */
export function getTrackCellCount(): number {
  return getPhysicsEngine().get_track_cell_count()
}

/**
 * Update track temperature from normal driving (heat generation, road drying)
 * Call this every frame when car is moving (even without skidding)
 */
export function updateCarDriving(x: number, z: number, speedMs: number, delta: number): void {
  getPhysicsEngine().update_car_driving(x, z, speedMs, delta)
}

// ============================================================================
// Water Depth and Aquaplaning API
// ============================================================================

/**
 * Get water depth at a position (0.0 to 1.0)
 * Higher values indicate deeper standing water
 */
export function getWaterDepth(x: number, z: number): number {
  return getPhysicsEngine().get_water_depth(x, z)
}

/**
 * Set rain exposure for a cell (0.0 = fully sheltered, 1.0 = open sky)
 * Use this to mark covered areas like tunnels or pit garages
 */
export function setRainExposure(x: number, z: number, exposure: number): void {
  getPhysicsEngine().set_rain_exposure(x, z, exposure)
}

/**
 * Set drainage rate for a cell (based on track slope)
 * Higher values mean water drains faster
 */
export function setDrainageRate(x: number, z: number, rate: number): void {
  getPhysicsEngine().set_drainage_rate(x, z, rate)
}

/**
 * Mark a cell as road surface
 * Road surfaces retain heat better than non-road surfaces,
 * but lose heat faster when it's raining
 */
export function setRoadCell(x: number, z: number, isRoad: boolean): void {
  getPhysicsEngine().set_road_cell(x, z, isRoad)
}

/**
 * Mark a rectangular region as road surface
 * Useful for registering entire road segments at once
 */
export function setRoadRegion(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  isRoad: boolean,
): void {
  getPhysicsEngine().set_road_region(minX, minZ, maxX, maxZ, isRoad)
}

/**
 * Check for aquaplaning conditions at a position
 * Returns aquaplaning state with intensity and affected wheels
 */
export function checkAquaplaning(x: number, z: number, speedMs: number): AquaplaningState {
  return getPhysicsEngine().check_aquaplaning(x, z, speedMs) as AquaplaningState
}

// ============================================================================
// Tire Thermal Shock API
// ============================================================================

/**
 * Check if tires are currently in thermal shock
 */
export function isTireThermalShock(): boolean {
  return getPhysicsEngine().is_tire_thermal_shock()
}

/**
 * Get current thermal shock state
 * Returns shock state with grip penalty and recovery time
 */
export function getThermalShockState(): TireThermalShock {
  return getPhysicsEngine().get_thermal_shock_state() as TireThermalShock
}

/**
 * Get debug state string
 */
export function getDebugState(): string {
  return getPhysicsEngine().get_debug_state() as string
}

// ============================================================================
// ERS (Energy Recovery System) API
// ============================================================================

/**
 * Set ERS deployment mode
 * @param mode - 0 = Balanced, 1 = Attack, 2 = Harvest, 3 = Overtake, 4 = SemiAuto
 */
export function setErsMode(mode: ErsMode): void {
  const modeIndex =
    mode === 'Balanced'
      ? 0
      : mode === 'Attack'
        ? 1
        : mode === 'Harvest'
          ? 2
          : mode === 'Overtake'
            ? 3
            : 4 // SemiAuto
  getPhysicsEngine().set_ers_mode(modeIndex)
}

/**
 * Get current ERS mode
 */
export function getErsMode(): ErsMode {
  const modeIndex = getPhysicsEngine().get_ers_mode()
  switch (modeIndex) {
    case 0:
      return 'Balanced'
    case 1:
      return 'Attack'
    case 2:
      return 'Harvest'
    case 3:
      return 'Overtake'
    case 4:
      return 'SemiAuto'
    default:
      return 'Balanced'
  }
}

/**
 * Get current ERS battery charge (0.0-1.0)
 */
export function getErsBatteryCharge(): number {
  return getPhysicsEngine().get_ers_battery_charge()
}

/**
 * Set ERS battery charge (0.0-1.0)
 * Useful for pit stops or testing
 */
export function setErsBatteryCharge(charge: number): void {
  getPhysicsEngine().set_ers_battery_charge(charge)
}

/**
 * Set ERS overtake availability (testing mode only)
 */
export function setErsOvertakeAvailable(available: boolean): void {
  getPhysicsEngine().set_ers_overtake_available(available)
}

/**
 * Get current ERS state directly from WASM engine
 */
export function getErsState(): ErsState {
  const raw = getPhysicsEngine().get_ers_state() as ErsState | null
  if (raw && typeof raw.battery_charge === 'number') {
    return raw
  }
  return {
    battery_charge: getErsBatteryCharge(),
    mode: getErsMode(),
    power_flow: 0,
    is_deploying: false,
    is_harvesting: false,
    super_clip_active: false,
    harvest_source: 'None',
    overtake_available: false,
    semi_auto: {
      coast_recommended: false,
      coast_benefit: 0,
      deploy_efficiency: 1,
      is_critical: false,
      effective_deploy_mult: 0.35,
      effective_harvest_mult: 0.9,
    },
    lap_recovered_mj: 0,
    lap_deployed_mj: 0,
    lap_recovery_cap_reached: false,
  }
}

// ============================================================================
// Semi-Auto ERS API
// ============================================================================

/**
 * Set Semi-Auto ERS preset
 * @param preset - 'Balanced', 'Aggressive', or 'Conservative'
 */
export function setErsSemiAutoPreset(preset: SemiAutoPreset): void {
  const presetIndex = preset === 'Balanced' ? 0 : preset === 'Aggressive' ? 1 : 2
  getPhysicsEngine().set_ers_semi_auto_preset(presetIndex)
}

/**
 * Get current Semi-Auto preset
 */
export function getErsSemiAutoPreset(): SemiAutoPreset {
  const presetIndex = getPhysicsEngine().get_ers_semi_auto_preset()
  switch (presetIndex) {
    case 0:
      return 'Balanced'
    case 1:
      return 'Aggressive'
    case 2:
      return 'Conservative'
    default:
      return 'Balanced'
  }
}

/**
 * Get Semi-Auto ERS configuration
 */
export function getErsSemiAutoConfig(): SemiAutoConfig {
  const config = getPhysicsEngine().get_ers_semi_auto_config()
  // Map preset number to string
  const presetMap: Record<number, SemiAutoPreset> = {
    0: 'Balanced',
    1: 'Aggressive',
    2: 'Conservative',
  }
  return {
    ...config,
    preset: presetMap[config.preset] ?? 'Balanced',
  }
}

/**
 * Set ERS lap mode (race-aware strategy)
 */
export function setErsLapMode(enabled: boolean): void {
  getPhysicsEngine().set_ers_lap_mode(enabled)
}

/**
 * Set ERS expert mode (manual control in SemiAuto mode)
 */
export function setErsExpertMode(enabled: boolean): void {
  getPhysicsEngine().set_ers_expert_mode(enabled)
}

/**
 * Activate ERS overtake override (temporary 100% deploy in SemiAuto mode)
 */
export function activateErsOvertake(): void {
  getPhysicsEngine().activate_ers_overtake()
}

/**
 * Deactivate ERS overtake override
 */
export function deactivateErsOvertake(): void {
  getPhysicsEngine().deactivate_ers_overtake()
}

/**
 * Check if ERS overtake override is active
 */
export function isErsOvertakeOverride(): boolean {
  return getPhysicsEngine().is_ers_overtake_override()
}

// ============================================================================
// Rubber Deposit / Tire Marks API
// ============================================================================

/**
 * Update rubber deposits from per-wheel positions (for tire marks)
 *
 * @param wheelPositions - Flat array of 8 floats: [FL_x, FL_z, FR_x, FR_z, RL_x, RL_z, RR_x, RR_z]
 * @param wheelIntensities - Array of 4 floats: [FL, FR, RL, RR] intensity (0.0-1.0)
 * @param delta - Time delta in seconds
 */
export function updateRubberDeposits(
  wheelPositions: Float32Array | number[],
  wheelIntensities: Float32Array | number[],
  delta: number,
): void {
  const posArray =
    wheelPositions instanceof Float32Array ? wheelPositions : new Float32Array(wheelPositions)
  const intArray =
    wheelIntensities instanceof Float32Array ? wheelIntensities : new Float32Array(wheelIntensities)

  getPhysicsEngine().update_rubber_deposits(posArray, intArray, delta)
}

/**
 * Get active surface cells with water/ice data
 * Returns flat Float32Array: [worldX, worldZ, waterDepth, wetness, iceFraction, ...] per cell
 * Only includes cells with waterDepth > 0.1 or ice > 0.1
 */
export function getActiveSurfaceCells(): Float32Array {
  recordWasmCall()
  return new Float32Array(getPhysicsEngine().get_active_surface_cells())
}

/**
 * Get track wetness at a position (0.0 to 1.0)
 * Used for rubber intensity calculation - wet tracks reduce rubber transfer
 */
export function getTrackWetness(x: number, z: number): number {
  return getPhysicsEngine().get_track_wetness(x, z)
}

/**
 * Get tire compound rubber deposit multiplier
 * Soft tires (1.4) leave more rubber, Hard tires (0.7) leave less
 */
export function getRubberDepositMultiplier(): number {
  return getPhysicsEngine().get_rubber_deposit_multiplier()
}

export interface RubberFrameResult {
  compoundMult: number
  wetness: number
}

/**
 * Batched rubber frame update — combines updateCarDriving, getRubberDepositMultiplier,
 * getTrackWetness, and updateRubberDeposits into a single FFI call.
 * Wave 2 Phase 4: writes into a shared 2-element scratch buffer so the
 * FFI boundary doesn't allocate per call. Single-owner buffer; safe
 * under the current sequential 120Hz game loop. A future GhostCar or
 * second tire-trail system would need its own scratch.
 */
const rubberFrameScratch = new Float32Array(2)

export function updateRubberFrame(
  carX: number,
  carZ: number,
  speedMs: number,
  delta: number,
  wheelPositions: Float32Array,
  wheelIntensities: Float32Array,
): RubberFrameResult {
  getPhysicsEngine().update_rubber_frame(
    carX,
    carZ,
    speedMs,
    delta,
    wheelPositions,
    wheelIntensities,
    rubberFrameScratch,
  )
  return { compoundMult: rubberFrameScratch[0], wetness: rubberFrameScratch[1] }
}

// ============================================================================
// Pit Lane API
// ============================================================================

/**
 * Set pit lane active state
 * @param active - Whether the car is in the pit lane
 */
export function setPitLaneActive(active: boolean): void {
  getPhysicsEngine().set_pit_lane_active(active)
}

/**
 * Check if the car is currently in the pit lane
 */
export function isPitLaneActive(): boolean {
  return getPhysicsEngine().is_pit_lane_active()
}

/**
 * Set pit lane speed limit
 * @param kmh - Speed limit in km/h
 */
export function setPitLaneSpeedLimit(kmh: number): void {
  getPhysicsEngine().set_pit_lane_speed_limit(kmh)
}

/**
 * Get pit lane speed limit in km/h
 */
export function getPitLaneSpeedLimitKmh(): number {
  return getPhysicsEngine().get_pit_lane_speed_limit_kmh()
}

/**
 * Check if the pit lane speed limiter is currently active
 */
export function isPitLaneSpeedLimited(): boolean {
  return getPhysicsEngine().is_pit_lane_speed_limited()
}

/**
 * Get pit lane limiter blend factor (0.0 = no limit, 1.0 = fully limited)
 */
export function getPitLaneLimiterBlend(): number {
  return getPhysicsEngine().get_pit_lane_limiter_blend()
}

// ============================================================================
// Default Input Factory
// ============================================================================

/**
 * Create a default CarInput object
 */
export function createDefaultInput(): CarInput {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
    handbrake: false,
  }
}

/**
 * Create CarInput from keyboard state
 */
export function inputFromKeyboard(keys: {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  brake: boolean
  handbrake: boolean
}): CarInput {
  return { ...keys }
}

// ============================================================================
// Temperature Utility Functions
// ============================================================================

/**
 * Convert normalized engine temp (0-1) to Celsius (20-160C)
 */
export function engineTempToCelsius(normalized: number): number {
  return normalized * 140 + 20
}

/**
 * Convert normalized tire temp (0-1) to Celsius (20-180C)
 */
export function tireTempToCelsius(normalized: number): number {
  return normalized * 160 + 20
}

/**
 * Convert normalized ambient/track temp (0-1) to Celsius (-20 to 50C)
 */
export function ambientTempToCelsius(normalized: number): number {
  return normalized * 70 - 20
}

/**
 * Convert Celsius to normalized ambient temp (for setting weather)
 */
export function celsiusToNormalizedAmbient(celsius: number): number {
  return (celsius + 20) / 70
}

/**
 * Get wheel average temperature from per-wheel temperature
 */
export function getWheelAvgTemp(temps: PerWheelTemperature, wheel: 0 | 1 | 2 | 3): number {
  switch (wheel) {
    case 0:
      return (temps.front_left_inner + temps.front_left_outer) / 2
    case 1:
      return (temps.front_right_inner + temps.front_right_outer) / 2
    case 2:
      return (temps.rear_left_inner + temps.rear_left_outer) / 2
    case 3:
      return (temps.rear_right_inner + temps.rear_right_outer) / 2
  }
}

// ============================================================================
// Active Aero API
// ============================================================================

/**
 * Set active aero mode
 * @param mode - 'Corner', 'Straight', or 'Drs' (DRS only takes effect inside a DRS zone)
 */
export function setAeroMode(mode: AeroMode): void {
  const modeIndex = mode === 'Corner' ? 0 : mode === 'Straight' ? 1 : 2
  getPhysicsEngine().set_aero_mode(modeIndex)
}

/**
 * Wave 4 Phase 5: Override Mode (2026 F1 DRS replacement). Driver-
 * activated 350 kW MGU-K boost with 0.5 MJ/lap budget. Auto-deactivates
 * on brake or budget exhaustion. Hold the request across frames; pass
 * `false` when the driver releases the bind.
 */
export function setOverrideRequested(requested: boolean): void {
  getPhysicsEngine().set_override_requested(requested)
}

/** Override Mode budget used this lap (0.0..1.0). */
export function getOverrideEnergyUsedPct(): number {
  return getPhysicsEngine().get_override_energy_used_pct()
}

/** Reset Override Mode budget at lap rollover. */
export function resetOverrideLapBudget(): void {
  getPhysicsEngine().reset_override_lap_budget()
}

/**
 * Get current aero mode
 */
export function getAeroMode(): AeroMode {
  const modeIndex = getPhysicsEngine().get_aero_mode()
  return modeIndex === 0 ? 'Corner' : modeIndex === 1 ? 'Straight' : 'Drs'
}

/**
 * Mark the car as inside/outside a DRS zone. Outside a zone, `Drs`
 * mode automatically falls back to Straight behavior.
 */
export function setDrsZone(inZone: boolean): void {
  getPhysicsEngine().set_drs_zone(inZone)
}

/** Force DRS off (call when the driver applies the brake). */
export function disableDrsOnBrake(): void {
  getPhysicsEngine().disable_drs_on_brake()
}

/** Reset per-lap ERS accounting (8.5 MJ cap, deployed counter). */
export function resetErsLap(): void {
  getPhysicsEngine().reset_ers_lap()
}

/**
 * Get current active aero state
 * Returns wing angles and multipliers based on current mode
 */
export function getActiveAeroState(): ActiveAeroState {
  return getPhysicsEngine().get_active_aero_state() as ActiveAeroState
}

/**
 * Toggle auto aero mode on/off
 */
export function toggleAeroAuto(): void {
  getPhysicsEngine().toggle_aero_auto()
}

// ============================================================================
// Brake System API
// ============================================================================

/**
 * Set brake bias (front percentage)
 * @param bias - Front brake bias as percentage (50-70)
 */
export function setBrakeBias(bias: number): void {
  const normalized = Math.max(0.5, Math.min(0.7, bias / 100))
  getPhysicsEngine().set_brake_bias(normalized)
}

/**
 * Get current brake bias (front percentage)
 * @returns Front brake bias as percentage (50-70)
 */
export function getBrakeBias(): number {
  return getPhysicsEngine().get_brake_bias() * 100
}

/**
 * Increase brake bias by 2%
 */
export function increaseBrakeBias(): void {
  getPhysicsEngine().increase_brake_bias()
}

/**
 * Decrease brake bias by 2%
 */
export function decreaseBrakeBias(): void {
  getPhysicsEngine().decrease_brake_bias()
}

/**
 * Set engine braking level
 * @param level - 'Low', 'Medium', or 'High'
 */
export function setEngineBrakingLevel(level: EngineBrakingLevel): void {
  const levelIndex = level === 'Low' ? 0 : level === 'Medium' ? 1 : 2
  getPhysicsEngine().set_engine_braking_level(levelIndex)
}

/**
 * Get current engine braking level
 */
export function getEngineBrakingLevel(): EngineBrakingLevel {
  const levelIndex = getPhysicsEngine().get_engine_braking_level()
  return levelIndex === 0 ? 'Low' : levelIndex === 1 ? 'Medium' : 'High'
}

/**
 * Cycle engine braking level (Low -> Medium -> High -> Low)
 */
export function cycleEngineBrakingLevel(): void {
  getPhysicsEngine().cycle_engine_braking_level()
}

/**
 * Get current brake state from physics engine
 */
export function getBrakeState(): BrakeState {
  return getPhysicsEngine().get_brake_state() as BrakeState
}

// ============================================================================
// Terrain API
// ============================================================================

export function initTerrain(cellSize: number, originX: number, originZ: number): void {
  const engine = getPhysicsEngine()
  engine.init_terrain(sanitize(cellSize, 1.0), sanitize(originX), sanitize(originZ))
}

export function setTerrainCell(x: number, z: number, height: number, materialId: number): void {
  const engine = getPhysicsEngine()
  engine.set_terrain_cell(sanitize(x), sanitize(z), sanitize(height), materialId)
}

export function setTerrainRegion(
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
  height: number,
  materialId: number,
): void {
  const engine = getPhysicsEngine()
  engine.set_terrain_region(
    sanitize(minX),
    sanitize(minZ),
    sanitize(maxX),
    sanitize(maxZ),
    sanitize(height),
    materialId,
  )
}

export function setTerrainHeight(x: number, z: number, height: number): void {
  const engine = getPhysicsEngine()
  engine.set_terrain_height(sanitize(x), sanitize(z), sanitize(height))
}

export function queryTerrain(x: number, z: number): TerrainQueryResult | null {
  const engine = getPhysicsEngine()
  return engine.query_terrain(sanitize(x), sanitize(z)) as TerrainQueryResult | null
}

export function isTerrainInitialized(): boolean {
  const engine = getPhysicsEngine()
  return engine.is_terrain_initialized()
}

export function loadTerrainHeightmap(
  data: Float32Array,
  width: number,
  height: number,
  originX: number,
  originZ: number,
  cellSize: number,
): void {
  const engine = getPhysicsEngine()
  engine.load_terrain_heightmap(
    data,
    width,
    height,
    sanitize(originX),
    sanitize(originZ),
    sanitize(cellSize, 1.0),
  )
}

export function clearTerrain(): void {
  const engine = getPhysicsEngine()
  engine.clear_terrain()
}
