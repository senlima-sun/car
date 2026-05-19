#!/usr/bin/env bun

import type { CircuitConfigFile } from './circuits/_schema'

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

async function main(): Promise<void> {
  const name = process.argv[2]
  if (!name) {
    process.stderr.write('Usage: bun run track:add <circuit-name>\n')
    process.exit(1)
  }

  const circuitName = name.toLowerCase()
  const config = await resolveConfig(circuitName)

  if (config.provenance === 'osm') {
    process.stdout.write(`Ingesting ${config.displayName} from OSM (includes validation gate)...\n`)
    const ok = await runStep(['track:ingest', circuitName])
    if (!ok) {
      process.stderr.write(`track:add: ingest failed for ${circuitName}\n`)
      process.exit(1)
    }
  } else {
    process.stdout.write(`Validating source for ${config.displayName} (manual provenance)...\n`)
    const ok = await runStep(['track:validate-source', circuitName])
    if (!ok) {
      process.stderr.write(`track:add: source validation failed for ${circuitName}\n`)
      process.exit(1)
    }
  }

  const canFetchElevation =
    (config.provenance === 'osm' && config.terrainBBox) ||
    (config.provenance === 'manual' && config.terrainGeoref)
  if (canFetchElevation) {
    process.stdout.write(`Fetching elevation sidecar for ${circuitName}...\n`)
    const ok = await runStep(['track:elevation:fetch', circuitName])
    if (!ok) {
      process.stderr.write(
        `track:add: elevation fetch failed for ${circuitName} (non-fatal; track is still usable)\n`,
      )
    }
  }

  process.stdout.write(`Track ${circuitName}: source OK\n`)
  process.exit(0)
}

await main()
