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
  drs: boolean
}

export interface PerWheelWear {
  front_left: number
  front_right: number
  rear_left: number
  rear_right: number
}

export interface CarPhysicsOutput {
  linear_velocity: [number, number, number]
  angular_velocity: [number, number, number]
  speed_kmh: number
  gear: number
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
    drs: false,
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
  drs: boolean
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
