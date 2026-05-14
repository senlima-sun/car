# Monorepo

This repo is a pnpm + Turborepo workspace.

## Layout

- `apps/game/` — F1 simulator SPA (React + Three.js + WASM).
- `physics-engine/` — Rust crate compiled to WASM. Lives at the repo root because it is a Cargo crate, not a pnpm package.
- `packages/physics/` — TS stub (placeholder for future re-export of the WASM bridge).
- `scripts/` — root-level data pipeline (track ingest, perf smoke, validation).

## Tooling

- **pnpm** — dependency manager + workspace orchestrator. `pnpm-lock.yaml` is authoritative.
- **Bun** — runtime, dev server (HMR + React Fast Refresh), test runner, bundler.
- **Turborepo** — task orchestration + content-hashed caching (local + self-hosted remote).
- **Rust + wasm-pack** — physics engine compilation.

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
rm -rf .turbo apps/game/dist apps/game/src/wasm/pkg
pnpm turbo run build --summarize

# Warm-remote: should pull from remote (fast)
rm -rf .turbo apps/game/dist apps/game/src/wasm/pkg
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

- `pnpm run dev:wasm` — superseded by `pnpm run dev`, which starts the in-process Rust watcher automatically.

## Known follow-ups

- **WASM debug vs release**: `pnpm run build:wasm` produces debug WASM and is the cached task. `pnpm run build:wasm:release` is uncached and produces optimized WASM. Before wiring `pnpm run build` to a production deploy, decide whether to add a separate `//#build:wasm:release` turbo task with its own output dir, or to switch the default `build:wasm` to release once dev iteration speed is no longer the dominant concern.
- **packages/physics build inputs**: The `build` task's input globs (`src/**`, `build/**`, `public/**`, `index.html`, `bunfig.toml`) are `@car/game`-shaped. When `packages/physics` gets a real `build` script in Phase 2, give it a per-package input override so its cache key tracks only its own files.
