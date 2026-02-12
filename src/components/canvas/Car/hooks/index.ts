/**
 * Car-related custom hooks
 */

export { useCarFrame } from './useCarFrame'
export { type CarState } from './types'
export { useEngineThermal } from './useEngineThermal'
export { usePhysicsSync } from './usePhysicsSync'
export { useStartPosition, type StartTransform } from './useStartPosition'

// WASM type mapping utilities
export { mapTireToWasm, mapSurfaceToWasm } from './wasmMappings'
