/**
 * Back-compat shim: re-exports the bridge from @car/physics so existing
 * `../wasm/PhysicsBridge` imports keep working without per-file rewrites.
 * Direct consumers can switch to `@car/physics` or `@/wasm` over time.
 */
export * from '@car/physics'
