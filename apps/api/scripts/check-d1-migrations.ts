import { spawnSync } from 'node:child_process'

function exitWith(message: string, code = 1): never {
  console.error(message)
  process.exit(code)
}

const result = spawnSync('wrangler', ['d1', 'migrations', 'list', 'DB', '--remote'], {
  encoding: 'utf8',
})

const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

if (result.status !== 0) {
  exitWith(
    `[d1-migrations] wrangler exited with ${result.status}; cannot verify migration state — aborting deploy.\n` +
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
