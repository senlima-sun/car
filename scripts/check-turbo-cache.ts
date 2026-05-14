#!/usr/bin/env bun
/**
 * Sanity-check turbo remote cache wiring.
 *
 * Verifies (a) required env vars resolve, (b) turbo can parse turbo.json,
 * (c) turbo emits a valid task graph. Exits non-zero with actionable
 * messages otherwise. Intended for CI (post-env-var setup) and local
 * debugging.
 *
 * Note: actual HIT/MISS verification against the remote requires a real
 * build run — see docs/monorepo.md for the --summarize recipe.
 */

import { spawnSync } from 'bun'

const REQUIRED_VARS = ['TURBO_TOKEN', 'TURBO_API', 'TURBO_TEAM'] as const
const OPTIONAL_VARS = ['TURBO_REMOTE_CACHE_SIGNATURE_KEY'] as const

function exitWith(message: string, code = 1): never {
  console.error(message)
  process.exit(code)
}

const missing = REQUIRED_VARS.filter(name => !process.env[name])
if (missing.length > 0) {
  exitWith(
    `[turbo-cache] Missing required env vars: ${missing.join(', ')}.\n` +
      `Source your local .env or export them before running this script.\n` +
      `See .env.example for the expected shape.`,
  )
}

const optionalMissing = OPTIONAL_VARS.filter(name => !process.env[name])
if (optionalMissing.length > 0) {
  console.warn(
    `[turbo-cache] Optional env vars not set: ${optionalMissing.join(', ')}. ` +
      `Cache artifacts will not be signed. Consider setting this in production.`,
  )
}

const result = spawnSync({
  cmd: ['pnpm', 'turbo', 'run', 'build:wasm', '--dry=json'],
  stdout: 'pipe',
  stderr: 'inherit',
})

if (result.exitCode !== 0) {
  exitWith(`[turbo-cache] turbo --dry=json failed with exit code ${result.exitCode}.`)
}

const stdout = new TextDecoder().decode(result.stdout)
let parsed: { tasks?: Array<{ taskId: string; hash: string }>; turboVersion?: string }
try {
  parsed = JSON.parse(stdout) as typeof parsed
} catch (err) {
  exitWith(
    `[turbo-cache] Failed to parse turbo --dry=json output as JSON: ${(err as Error).message}`,
  )
}

if (!parsed.turboVersion || !parsed.tasks || parsed.tasks.length === 0) {
  exitWith(
    `[turbo-cache] Unexpected turbo --dry=json shape — turboVersion or tasks missing.\n` +
      `Check that turbo.json is valid and tasks are declared.`,
  )
}

const buildWasm = parsed.tasks.find(t => t.taskId === '//#build:wasm')
if (!buildWasm || !buildWasm.hash) {
  exitWith(
    `[turbo-cache] //#build:wasm task not found in graph or missing hash.\n` +
      `Check turbo.json root tasks.`,
  )
}

console.log(
  `[turbo-cache] OK: env vars resolved, turbo ${parsed.turboVersion} parsed graph, ` +
    `//#build:wasm hash=${buildWasm.hash}.\n` +
    `Run 'pnpm turbo run build --summarize' for actual HIT/MISS verification (see docs/monorepo.md).`,
)
