/**
 * WASM Physics Engine — app-side shim.
 *
 * Re-exports the platform-agnostic @car/physics package and the React-coupled
 * PhysicsProvider. Also wires the package's perf/dev hooks to app utilities
 * once at module-load time.
 */

import { setPerfHook, setIsDev } from '@car/physics'
import { incrementWasmCalls } from '../debug/perfCounters'
import { IS_DEV } from '../utils/isDev'

setPerfHook(incrementWasmCalls)
setIsDev(IS_DEV)

export * from '@car/physics'
export { PhysicsProvider, usePhysics, usePhysicsOptional } from './PhysicsProvider'
