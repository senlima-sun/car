/**
 * Car component module
 *
 * Main car component with WASM physics engine integration.
 * Organized into:
 * - parts/     - Visual components (body, wheels, cockpit, effects)
 * - hooks/     - Custom hooks (physics sync, frame loop, position)
 * - constants/ - Material presets, colors, positions
 */

export { default as Car } from './Car'
export { default } from './Car'

// Re-export parts for direct access if needed
export * from './parts'

// Re-export hooks for direct access if needed
export * from './hooks'

// Re-export constants for direct access if needed
export * from './constants'
