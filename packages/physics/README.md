# @car/physics

Type-safe TypeScript bridge over the Rust/WASM physics engine that drives the car simulator.

## Surface

- **`initPhysicsEngine()`** — async initializer. Must complete before any other call.
- **`stepAndSync(dt, input, ...)`** — single FFI call that ticks physics + reads back state. Preferred over the lower-level `stepPhysics`.
- **~100 wrapper functions** grouped by domain: weather, wind, tires, ERS, active aero, brakes, terrain, surface, fuel, differential, drivetrain.
- **`setPerfHook(fn)` / `setIsDev(b)`** — optional dependency-injection hooks. Apps that want WASM-call counters or dev-mode warnings call these once at startup. Defaults are no-ops so the package works standalone.
- **`./pkg` subpath** — direct access to wasm-pack output (`car_physics_engine.js`) for low-level consumers.

The React `PhysicsProvider` lives in `apps/game/src/wasm/PhysicsProvider.tsx` (separate concern, app-coupled). The app's `apps/game/src/wasm/index.ts` is a thin shim that wires the hooks and re-exports `@car/physics`.

## Build order

`pnpm -w run build:wasm` must run before TS sees this package successfully — without `pkg/`, type imports fail because `PhysicsBridge.ts` imports from `../pkg/car_physics_engine`. The turbo task graph (`//#build:wasm` → `build`/`test`/`typecheck`) handles this automatically when invoked through turbo.

Local first-run incantation:

```sh
pnpm install
pnpm -w run build:wasm   # writes packages/physics/pkg/
pnpm --filter @car/game dev
```

## Constraints

- Do not rename the Cargo crate `car_physics_engine` without updating `PhysicsBridge.ts`'s import of `'../pkg/car_physics_engine'`.
- Do not reach into `apps/game/src/` from inside this package. App-side state belongs in app code; cross the boundary via `setPerfHook` / `setIsDev` or new hook setters added in `src/internal/`.
- The WASM URL `/src/wasm/pkg/car_physics_engine_bg.wasm` is hardcoded in `PhysicsBridge.ts` and resolved at runtime by the dev server (`STATIC_PREFIXES`) and production bundle (`WASM_DIST_DIR`). Phase 2B (bundler swap) will replace this with a Vite asset import.
