/**
 * WASM Physics Engine exports
 */

// Core bridge functions
export {
  initPhysicsEngine,
  isPhysicsEngineInitialized,
  getPhysicsEngine,
  stepPhysics,
  getWeatherModifiers,
  getAmbientConditions,
  // Weather API
  setCustomWeather,
  getRainIntensity,
  // Wind API
  setWind,
  setWindEnabled,
  isWindEnabled,
  getWindState,
  getWindModifiers,
  // Tire API
  setTireCompound,
  getTireCompound,
  getTireWear,
  resetTireWear,
  getEffectiveGrip,
  setOnCurb,
  isOnCurb,
  setSurface,
  getSurface,
  isOnRoad,
  isOffTrack,
  getSurfaceModifiers,
  initTrackTemperature,
  getTrackTextureData,
  getTrackCellCount,
  updateCarDriving,
  // Road temperature API
  setRoadCell,
  setRoadRegion,
  getDebugState,
  createDefaultInput,
  inputFromKeyboard,
  TireCompound,
  SurfaceType,
  // ERS API
  setErsMode,
  getErsMode,
  getErsBatteryCharge,
  setErsBatteryCharge,
  getErsState,
  // Active Aero API
  setAeroMode,
  getAeroMode,
  getActiveAeroState,
  // Brake System API
  setBrakeBias,
  getBrakeBias,
  increaseBrakeBias,
  decreaseBrakeBias,
  setEngineBrakingLevel,
  getEngineBrakingLevel,
  cycleEngineBrakingLevel,
  getBrakeState,
} from './PhysicsBridge'

export type {
  CarInput,
  CarPhysicsOutput,
  WeatherModifiers,
  SurfaceModifiers,
  TrackBounds,
  AmbientConditions,
  WindState,
  WindModifiers,
  ErsMode,
  ErsState,
  AeroMode,
  ActiveAeroState,
  EngineBrakingLevel,
  BrakeState,
} from './PhysicsBridge'

// React provider
export { PhysicsProvider, usePhysics, usePhysicsOptional } from './PhysicsProvider'
