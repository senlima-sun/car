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

Sanity-check before running CI: `pnpm run scripts/check-turbo-cache.ts` (added in Phase 1.4) confirms the four env vars resolve and remote caching is wired.

## Test discovery

`pnpm --filter @car/game test` runs `bun test` inside `apps/game/`. Tests outside the app (notably `scripts/lib/validate/validate-source.test.ts`) are covered by the separate `pnpm run test:scripts` invocation. This is intentionally NOT a turbo task so its cache key does not couple to app source.

## Deprecated commands

- `pnpm run dev:wasm` — superseded by `pnpm run dev`, which starts the in-process Rust watcher automatically.
