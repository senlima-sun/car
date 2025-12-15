/**
 * WASM Physics Engine exports
 */

// Core bridge functions
export {
  initPhysicsEngine,
  isPhysicsEngineInitialized,
  getPhysicsEngine,
  stepPhysics,
  setWeather,
  getWeather,
  getWeatherModifiers,
  isWeatherTransitioning,
  setTireCompound,
  getTireCompound,
  getTireWear,
  resetTireWear,
  getEffectiveGrip,
  setOnCurb,
  isOnCurb,
  initTrackTemperature,
  getTrackTextureData,
  getTrackCellCount,
  getDebugState,
  createDefaultInput,
  inputFromKeyboard,
  WeatherCondition,
  TireCompound,
} from './PhysicsBridge'

export type {
  CarInput,
  CarPhysicsOutput,
  WeatherModifiers,
  TrackBounds,
} from './PhysicsBridge'

// React provider
export {
  PhysicsProvider,
  usePhysics,
  usePhysicsOptional,
} from './PhysicsProvider'
