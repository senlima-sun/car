# @car/physics

Stub package. Phase 1 of the monorepo migration scaffolds this workspace name so future phases (Phase 2+) can move the wasm-pack output here and re-export the bridge.

Today the app at `apps/game/` imports the WASM bridge via relative paths into `apps/game/src/wasm/pkg/`. Phase 2 will either:

- Move wasm-pack output to `packages/physics/pkg/` and re-point the app's import to `@car/physics`, or
- Keep the output in `apps/game/src/wasm/pkg/` and have this package re-export it.

The decision is deferred until Phase 2.
