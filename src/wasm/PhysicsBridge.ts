/**
 * TypeScript bridge for Rust/WASM physics engine
 */

import init, {
  PhysicsEngine,
  WeatherCondition,
  TireCompound,
} from './pkg/car_physics_engine'

// Re-export types for convenience
export { WeatherCondition, TireCompound }

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
    throw new Error(
      'Physics engine not initialized. Call initPhysicsEngine() first.'
    )
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
 * Run a single physics step
 */
export function stepPhysics(
  delta: number,
  input: CarInput,
  position: [number, number, number],
  rotation: [number, number, number, number],
  linvel: [number, number, number],
  angvel: [number, number, number]
): CarPhysicsOutput {
  const eng = getPhysicsEngine()
  return eng.step(delta, input, position, rotation, linvel, angvel) as CarPhysicsOutput
}

/**
 * Set weather condition
 */
export function setWeather(weather: WeatherCondition): void {
  getPhysicsEngine().set_weather(weather)
}

/**
 * Get current weather condition
 */
export function getWeather(): WeatherCondition {
  return getPhysicsEngine().get_weather()
}

/**
 * Get current weather modifiers
 */
export function getWeatherModifiers(): WeatherModifiers {
  return getPhysicsEngine().get_weather_modifiers() as WeatherModifiers
}

/**
 * Check if weather is transitioning
 */
export function isWeatherTransitioning(): boolean {
  return getPhysicsEngine().is_weather_transitioning()
}

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
 * Initialize track temperature grid
 */
export function initTrackTemperature(
  cellSize: number,
  bounds: TrackBounds
): void {
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
 * Get debug state string
 */
export function getDebugState(): string {
  return getPhysicsEngine().get_debug_state() as string
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
