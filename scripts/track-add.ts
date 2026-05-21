import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import type { CircuitConfigFile } from './circuits/_schema'

async function resolveConfig(name: string): Promise<CircuitConfigFile> {
  const configPath = `scripts/circuits/${name}.config.json`
  if (!existsSync(configPath)) {
    process.stderr.write(`track:add: no config at ${configPath}\n`)
    process.stderr.write(
      `Create it first, then re-run: pnpm run track:add ${name}\n`,
    )
    process.exit(1)
  }
  return JSON.parse(await readFile(configPath, 'utf8')) as CircuitConfigFile
}

function runStep(args: string[]): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn('pnpm', ['-w', 'run', ...args], { stdio: 'inherit' })
    proc.on('exit', code => resolve(code === 0))
  })
}

async function main(): Promise<void> {
  const name = process.argv[2]
  if (!name) {
    process.stderr.write('Usage: pnpm run track:add <circuit-name>\n')
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

  if (config.terrainBBox || config.terrainGeoref) {
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
