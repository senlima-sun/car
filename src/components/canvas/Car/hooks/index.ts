/**
 * Car-related custom hooks
 */

export { useCarFrame, type CarState } from './useCarFrame'
export { useEngineThermal } from './useEngineThermal'
export { usePhysicsSync } from './usePhysicsSync'
export { useStartPosition, type StartTransform } from './useStartPosition'

// WASM type mapping utilities
export {
  mapWeatherToWasm,
  mapTireToWasm,
  mapSurfaceToWasm,
} from './wasmMappings'
