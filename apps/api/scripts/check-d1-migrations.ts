#!/usr/bin/env bun
import { spawnSync } from 'bun'

function exitWith(message: string, code = 1): never {
  console.error(message)
  process.exit(code)
}

const result = spawnSync({
  cmd: ['wrangler', 'd1', 'migrations', 'list', 'DB', '--remote'],
  stdout: 'pipe',
  stderr: 'pipe',
})

const stdout = new TextDecoder().decode(result.stdout)
const stderr = new TextDecoder().decode(result.stderr)
const combined = `${stdout}\n${stderr}`

if (result.exitCode !== 0) {
  exitWith(
    `[d1-migrations] wrangler exited with ${result.exitCode}; cannot verify migration state — aborting deploy.\n` +
      combined,
  )
}

if (combined.includes('No migrations to apply')) {
  process.exit(0)
}

exitWith(
  `[d1-migrations] Pending migrations on remote D1. Run \`pnpm --filter @car/api db:migrate:prod\` first.\n` +
    combined,
)
