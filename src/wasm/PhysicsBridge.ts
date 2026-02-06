/**
 * TypeScript bridge for Rust/WASM physics engine
 */

import init, { PhysicsEngine, TireCompound, SurfaceType } from './pkg/car_physics_engine'

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

export interface TrackBounds {
  min_x: number
  max_x: number
  min_z: number
  max_z: number
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
  /** Current engine temperature (0.0 = cold/20C, 1.0 = critical/120C) */
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

export type AeroMode = 'Corner' | 'Straight'

export interface ActiveAeroState {
  mode: AeroMode
  front_wing_angle: number // 0.0-1.0
  rear_wing_angle: number // 0.0-1.0
  drag_multiplier: number
  downforce_multiplier: number
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

export interface StepAndSyncOutput {
  physics: CarPhysicsOutput
  wind_state: WindState
  aero_state: ActiveAeroState
  brake_state: BrakeState
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
      await init()
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

/**
 * Sanitize a number value - replace NaN/Infinity with fallback
 */
function sanitize(value: number, fallback: number = 0): number {
  return Number.isFinite(value) ? value : fallback
}

/**
 * Sanitize a 3D vector
 */
function sanitizeVec3(
  vec: [number, number, number],
  fallback: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  return [
    sanitize(vec[0], fallback[0]),
    sanitize(vec[1], fallback[1]),
    sanitize(vec[2], fallback[2]),
  ]
}

/**
 * Run a single physics step
 */
export function stepPhysics(
  delta: number,
  input: CarInput,
  position: [number, number, number],
  rotation: [number, number, number, number],
  linvel: [number, number, number],
  angvel: [number, number, number],
): CarPhysicsOutput {
  const eng = getPhysicsEngine()

  // Sanitize inputs to prevent NaN propagation into WASM
  const safeLinvel = sanitizeVec3(linvel)
  const safeAngvel = sanitizeVec3(angvel)
  const safeDelta = sanitize(delta, 0.016) // Default to ~60fps

  return eng.step(safeDelta, input, position, rotation, safeLinvel, safeAngvel) as CarPhysicsOutput
}

/**
 * Combined physics step + state sync (fewer FFI calls)
 */
export function stepAndSync(
  delta: number,
  input: CarInput,
  position: [number, number, number],
  rotation: [number, number, number, number],
  linvel: [number, number, number],
  angvel: [number, number, number],
): StepAndSyncOutput {
  const eng = getPhysicsEngine()
  const safeLinvel = sanitizeVec3(linvel)
  const safeAngvel = sanitizeVec3(angvel)
  const safeDelta = sanitize(delta, 0.016)
  return eng.step_and_sync(safeDelta, input, position, rotation, safeLinvel, safeAngvel) as StepAndSyncOutput
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
  getPhysicsEngine().set_environment(celsius, humidity, precipitationRateMmh, pressureHpa, cloudCover)
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
 * Get per-wheel tire wear (0.0 to 1.0 per wheel)
 */
export function getTireWearPerWheel(): PerWheelWear {
  return getPhysicsEngine().get_tire_wear_per_wheel() as PerWheelWear
}

/**
 * Set curb contact state
 */
export function setOnCurb(isOnCurb: boolean, side?: 'left' | 'right'): void {
  getPhysicsEngine().set_on_curb(isOnCurb, side)
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
 * Initialize track temperature grid
 */
export function initTrackTemperature(cellSize: number, bounds: TrackBounds): void {
  getPhysicsEngine().init_track_temperature(cellSize, bounds)
}

/**
 * Get track temperature texture data (RGBA bytes)
 */
export function getTrackTextureData(): Uint8Array {
  return getPhysicsEngine().get_track_texture_data()
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
 * Get current ERS state from physics output
 */
export function getErsState(): ErsState {
  return {
    battery_charge: getErsBatteryCharge(),
    mode: getErsMode(),
    power_flow: 0, // Will be updated from physics output
    is_deploying: false,
    is_harvesting: false,
    super_clip_active: false, // Will be updated from physics output
    harvest_source: 'None', // Will be updated from physics output
    overtake_available: false, // Will be updated from physics output
    semi_auto: {
      coast_recommended: false,
      coast_benefit: 0,
      deploy_efficiency: 1,
      is_critical: false,
      effective_deploy_mult: 0.35,
      effective_harvest_mult: 0.9,
    },
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
 * Convert normalized engine temp (0-1) to Celsius (20-120C)
 */
export function engineTempToCelsius(normalized: number): number {
  return normalized * 100 + 20
}

/**
 * Convert normalized tire temp (0-1) to Celsius (20-150C)
 */
export function tireTempToCelsius(normalized: number): number {
  return normalized * 130 + 20
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
 * @param mode - 'Corner' for high downforce, 'Straight' for low drag
 */
export function setAeroMode(mode: AeroMode): void {
  const modeIndex = mode === 'Corner' ? 0 : 1
  getPhysicsEngine().set_aero_mode(modeIndex)
}

/**
 * Get current aero mode
 */
export function getAeroMode(): AeroMode {
  const modeIndex = getPhysicsEngine().get_aero_mode()
  return modeIndex === 0 ? 'Corner' : 'Straight'
}

/**
 * Get current active aero state
 * Returns wing angles and multipliers based on current mode
 */
export function getActiveAeroState(): ActiveAeroState {
  return getPhysicsEngine().get_active_aero_state() as ActiveAeroState
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
