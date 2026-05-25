# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A browser-based F1 2026 racing simulator built with React + Three.js + Rust/WASM. All physics calculations run in a custom Rust engine compiled to WASM; Rapier handles collision detection only; the car floats on raycast suspension (no contact colliders with ground/track).

## Core Principles for Working with Claude

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Prerequisites

- **pnpm 11+** - Dependency manager + workspace orchestrator (`pnpm-lock.yaml` is authoritative)
- **Vite 8** - Dev server (HMR + React Fast Refresh) and production bundler
- **Turborepo 2.x** - Task orchestration + content-hashed caching (local + self-hosted remote)
- **Rust + wasm-pack** - For compiling `physics-engine/` to WASM
- **cargo** - Rust package manager (comes with Rust)

## Monorepo Layout

- `apps/game/` — SPA (React + Three.js + WASM). Vite-bundled. Routes under `apps/game/src/routes/`.
- `apps/api/` — `@car/api` Cloudflare Worker (Hono + Better Auth + Drizzle + D1 + KV). User accounts, sessions, Polar subscription billing. See `docs/auth.md`.
- `physics-engine/` — Rust crate, stays at repo root (it's a Cargo crate, not a pnpm package).
- `packages/physics/` — `@car/physics` package: WASM bridge + wasm-pack output. The app imports physics via `@car/physics`.
- `scripts/` — root-level data pipeline (track ingest, perf smoke, validation).

See `docs/monorepo.md` for `pnpm -w` vs `--filter` conventions and remote cache details.

## Architecture

### Tech Stack

- **React 19** + TypeScript, **Three.js** via `@react-three/fiber`
- **@react-three/rapier** — Rapier for collision detection (NOT vehicle physics)
- **Rust/WASM** — Custom physics engine (`physics-engine/`) for all vehicle dynamics
- **Zustand** — State management (~30 stores in `apps/game/src/stores/`)
- **TanStack Router** — File-based routing in `apps/game/src/routes/`
- **Tailwind CSS v4** — UI styling via `@tailwindcss/vite`
- **Vite 8** — Dev server (HMR + React Fast Refresh) and production bundler; WASM via `vite-plugin-wasm`
- **Vitest 3** — Test runner (Vite-powered, node environment)
- **tsx 4** — TypeScript runner for root-level scripts (invoked via pnpm)
- **Hono + Better Auth + Drizzle + D1 + KV** — `@car/api` Cloudflare Worker (accounts, sessions, Polar billing)

### Quality Standards

- **No `@ts-ignore`**: use `@ts-expect-error` with issue link
- **No comments**: unless license headers, TODOs with context, or bug workarounds
- **Test coverage**: 80%+ API, 90%+ logic (run `pnpm test` before commits)
- **Pre-commit review**: `git diff --cached` before every commit
- **UI chrome**: import from `apps/game/src/components/ui/primitives` (`<Surface>`, `<AccentBar>`, `<LabelTag>`, `<IconButton>`, `<Divider>`). Do NOT introduce new `bg-black/X`, `rounded-[Npx]`, or `clipPath` inline panel styles — see `primitives/README.md`.
