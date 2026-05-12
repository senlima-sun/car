#!/usr/bin/env bun

import type { CircuitConfigFile } from './circuits/_schema'

const DEV_SERVER_URL = 'http://localhost:3000'
const DEV_SERVER_POLL_INTERVAL_MS = 1_000
const DEV_SERVER_POLL_CEILING_MS = 30_000

async function resolveConfig(name: string): Promise<CircuitConfigFile> {
  const configPath = `scripts/circuits/${name}.config.json`
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    process.stderr.write(`track:add: no config at ${configPath}\n`)
    process.stderr.write(
      `Create it first, then re-run: bun run track:add ${name}\n`,
    )
    process.exit(1)
  }
  return (await file.json()) as CircuitConfigFile
}

async function runStep(args: string[]): Promise<boolean> {
  const proc = Bun.spawn(['bun', 'run', ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  return code === 0
}

async function devServerIsUp(): Promise<boolean> {
  try {
    const res = await fetch(DEV_SERVER_URL, {
      signal: AbortSignal.timeout(2_000),
    })
    return res.status < 500
  } catch {
    return false
  }
}

async function waitForDevServer(): Promise<boolean> {
  const deadline = Date.now() + DEV_SERVER_POLL_CEILING_MS
  while (Date.now() < deadline) {
    if (await devServerIsUp()) return true
    await Bun.sleep(DEV_SERVER_POLL_INTERVAL_MS)
  }
  return false
}

async function main(): Promise<void> {
  const name = process.argv[2]
  if (!name) {
    process.stderr.write('Usage: bun run track:add <circuit-name>\n')
    process.exit(1)
  }

  const circuitName = name.toLowerCase()
  const config = await resolveConfig(circuitName)

  if (config.provenance === 'osm') {
    process.stdout.write(`[1/3] Ingesting ${config.displayName} from OSM (includes validation gate)...\n`)
    const ok = await runStep(['track:ingest', circuitName])
    if (!ok) {
      process.stderr.write(`track:add: ingest failed for ${circuitName}\n`)
      process.exit(1)
    }
  } else {
    process.stdout.write(`[1/3] Validating source for ${config.displayName} (manual provenance)...\n`)
    const ok = await runStep(['track:validate-source', circuitName])
    if (!ok) {
      process.stderr.write(`track:add: source validation failed for ${circuitName}\n`)
      process.exit(1)
    }
  }

  process.stdout.write(`[2/3] Checking dev server at ${DEV_SERVER_URL}...\n`)

  if (!(await devServerIsUp())) {
    process.stdout.write(`  Not responding yet — polling for up to ${DEV_SERVER_POLL_CEILING_MS / 1000}s...\n`)
    const up = await waitForDevServer()
    if (!up) {
      process.stderr.write(
        `Dev server not running — start \`bun run dev\` in another shell, then re-run track:add\n`,
      )
      process.exit(2)
    }
  }

  process.stdout.write(`[3/3] Running AI drive validation for ${config.displayName}...\n`)
  const driveOk = await runStep(['track:ai-drive', circuitName])
  if (!driveOk) {
    process.stderr.write(`track:add: AI drive validation failed for ${circuitName}\n`)
    process.exit(1)
  }

  process.stdout.write(
    `Track ${circuitName}: source OK, structural OK, AI drive OK\n`,
  )
  process.exit(0)
}

await main()
