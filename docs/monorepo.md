# Monorepo

This repo is a pnpm + Turborepo workspace.

## Layout

- `apps/game/` — F1 simulator SPA (React + Three.js + WASM).
- `physics-engine/` — Rust crate compiled to WASM. Lives at the repo root because it is a Cargo crate, not a pnpm package.
- `packages/physics/` — TS package owning the wasm-pack output + type-safe bridge. Consumed by `apps/game` as `@car/physics`. The React `PhysicsProvider` stays in `apps/game/src/wasm/` because it is React-coupled.
- `scripts/` — root-level data pipeline (track ingest, perf smoke, validation).

## Tooling

- **pnpm** — dependency manager + workspace orchestrator. `pnpm-lock.yaml` is authoritative.
- **Vite 8** — dev server (HMR + React Fast Refresh) and production bundler. Tailwind 4 via `@tailwindcss/vite`. WASM via `vite-plugin-wasm`. Routes via `@tanstack/router-plugin`.
- **Bun** — runtime (`bun test`, script runtime). Not the bundler.
- **Turborepo** — task orchestration + content-hashed caching (local + self-hosted remote).
- **Rust + wasm-pack** — physics engine compilation.

## Routing

File-based routes live at `apps/game/src/routes/`:

- `__root.tsx` — root layout with `<Outlet />`.
- `index.tsx` → `/` — main menu.
- `race.$trackId.tsx` → `/race/:trackId` — session.
- `track-editor.tsx` + `track-editor.$trackId.tsx` → `/track-editor`, `/track-editor/:trackId`.
- `showroom.tsx` → `/showroom`.
- `test-mode.tsx` → `/test-mode` (placeholder).
- `track-preview.tsx` (layout) + `track-preview.index.tsx` + `track-preview.$presetId.tsx` → preset list + single preview.
- `-useSyncGameStatus.ts` — internal hook (the `-` prefix tells TanStack's plugin to skip it as a route).

The `useSyncGameStatus(status)` hook synchronizes the route with `useGameStore.status`. URL is the source of truth; the store reflects it. The existing HUD branches on `GameStatus` to decide what overlay renders.

Routes regenerate `apps/game/src/routeTree.gen.ts` on every Vite invocation. The file is force-tracked (committed) but gitignored — `tsc` reads the committed stub without needing a prior Vite run.

## Remote cache

The remote cache endpoint is `https://turbo-cache.solemnissn.workers.dev`, team `car`. Configure via env vars (never commit tokens):

```sh
export TURBO_TOKEN=<your-token>
export TURBO_API=https://turbo-cache.solemnissn.workers.dev
export TURBO_TEAM=car
export TURBO_REMOTE_CACHE_SIGNATURE_KEY=<hmac-key>
```

`turbo.json` commits only the non-secret config (`apiUrl`, `teamSlug`, `signature: true`).

Sanity-check before running CI:

```sh
pnpm -w run check:turbo-cache
```

This confirms env vars resolve and `turbo --dry=json` reports `remoteCacheEnabled: true`. Exits non-zero with a helpful message otherwise.

### Verifying HIT/MISS

After exporting all four env vars:

```sh
# Cold: should upload to remote
rm -rf .turbo apps/game/dist packages/physics/pkg
pnpm turbo run build --summarize

# Warm-remote: should pull from remote (fast)
rm -rf .turbo apps/game/dist packages/physics/pkg
pnpm turbo run build --summarize
```

Inspect `.turbo/runs/<timestamp>.json` for per-task `"remote": "HIT"` entries on the second run.

## Running root-scoped scripts

`pnpm` resolves to the nearest workspace package when invoked. When running root-only scripts (e.g. `test:scripts`, `perf:smoke`, `track:*`, `build:wasm:release`) from the repo root, add `-w` (alias for `--workspace-root`):

```sh
pnpm -w run test:scripts
pnpm -w run perf:smoke
pnpm -w run track:add suzuka
```

App-scoped scripts use `--filter`:

```sh
pnpm --filter @car/game dev
pnpm --filter @car/game compress:glb
```

## Test discovery

`pnpm --filter @car/game test` runs `bun test` inside `apps/game/`. Tests outside the app (notably `scripts/lib/validate/validate-source.test.ts`) are covered by the separate `pnpm -w run test:scripts` invocation. This is intentionally NOT a turbo task so its cache key does not couple to app source.

## Deprecated commands

- `pnpm run dev:wasm` — superseded by `pnpm run dev`, which uses `concurrently` to run Vite + the Rust watcher.

## Known follow-ups

- **WASM debug vs release**: `pnpm run build:wasm` produces debug WASM and is the cached task. `pnpm run build:wasm:release` is uncached and produces optimized WASM. Before wiring `pnpm run build` to a production deploy, decide whether to add a separate `//#build:wasm:release` turbo task with its own output dir, or to switch the default `build:wasm` to release once dev iteration speed is no longer the dominant concern.
- **`PhysicsProvider` package promotion**: `apps/game/src/wasm/PhysicsProvider.tsx` is the remaining React-coupled surface that has not been moved into `@car/physics`. A future `packages/physics-react/` is a candidate when a second React consumer (e.g. a marketing demo) needs the provider.
- **Rename `GameStatus` enum to match URL names**: internal values (`'customize'`, `'preview'`) differ from user-facing URLs (`/track-editor`, `/showroom`). The mismatch is benign (sync layer aligns them) but renaming the enum to match URLs reduces cognitive load. Deferred to Phase 3 — touches every consumer of `useGameStore.status`.
- **First run after a wasm-pack output dir change is a cache MISS**: turbo's content-hashed cache treats outputs glob changes as full invalidation. Expected behavior.
