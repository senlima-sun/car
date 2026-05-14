#!/usr/bin/env bun
/**
 * Sanity-check turbo remote cache wiring.
 *
 * Asserts that the four env vars resolve and that `turbo run --dry=json --summarize=false`
 * reports `remoteCacheEnabled: true`. Exits non-zero with a helpful message otherwise.
 *
 * Intended for CI (post-env-var setup) and local debugging.
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
  exitWith(`[turbo-cache] turbo --dry-run failed with exit code ${result.exitCode}.`)
}

const stdout = new TextDecoder().decode(result.stdout)
let parsed: { remoteCacheEnabled?: boolean }
try {
  parsed = JSON.parse(stdout) as { remoteCacheEnabled?: boolean }
} catch (err) {
  exitWith(
    `[turbo-cache] Failed to parse turbo --dry-run output as JSON: ${(err as Error).message}`,
  )
}

if (parsed.remoteCacheEnabled !== true) {
  exitWith(
    `[turbo-cache] remoteCacheEnabled !== true in turbo --dry-run output.\n` +
      `Check turbo.json remoteCache config and env vars.`,
  )
}

console.log('[turbo-cache] OK: remote cache enabled and env vars resolved.')
