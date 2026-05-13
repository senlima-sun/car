#!/usr/bin/env bun

import type { CircuitConfigFile } from './circuits/_schema'

interface AutoTuneOptions {
  maxIterations: number
  lengthMatchOSM: boolean
  acceptHeading: boolean
  acceptSectorSplits: boolean
}

const DEFAULTS: AutoTuneOptions = {
  maxIterations: 6,
  lengthMatchOSM: true,
  acceptHeading: true,
  acceptSectorSplits: true,
}

async function loadConfig(name: string): Promise<CircuitConfigFile> {
  return (await Bun.file(`scripts/circuits/${name}.config.json`).json()) as CircuitConfigFile
}

async function writeConfig(name: string, config: CircuitConfigFile): Promise<void> {
  await Bun.write(
    `scripts/circuits/${name}.config.json`,
    JSON.stringify(config, null, 2) + '\n',
  )
}

interface IngestResult {
  exitCode: number
  stdout: string
  stderr: string
}

async function runIngest(name: string): Promise<IngestResult> {
  const proc = Bun.spawn(['bun', 'run', 'track:ingest', name], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  const code = await proc.exited
  return { exitCode: code, stdout, stderr }
}

function parseTrackLength(output: string): number | null {
  const m = output.match(/Track length: ~(\d+)m/)
  return m ? Number(m[1]) : null
}

function parseStartHeading(output: string): number | null {
  const m = output.match(/Start heading (-?\d+\.?\d*)° deviates/)
  return m ? Number(m[1]) : null
}

function parseSectorSplit(output: string): [number, number] | null {
  const m = output.match(/Auto-detected sectorSplits: \[(-?\d+\.?\d*), (-?\d+\.?\d*)\]/)
  if (m) return [Number(m[1]), Number(m[2])]
  return null
}

function hasSectorBandError(output: string): boolean {
  return /autoDetectSectorSplits/.test(output)
}

function hasLengthError(output: string): boolean {
  return /\[CRITICAL\] Track Length: Length \d+m deviates/.test(output)
}

function hasHeadingError(output: string): boolean {
  return /\[CRITICAL\] Start Heading: Start heading -?\d/.test(output)
}

function hasCurvatureSpike(output: string): boolean {
  return /\[CRITICAL\] Curvature Spike/.test(output)
}

function hasClosureError(output: string): boolean {
  return /\[CRITICAL\] Circuit Closure/.test(output)
}

async function tune(name: string, opts: AutoTuneOptions): Promise<void> {
  console.log(`\nAuto-tuning ${name}...`)
  for (let iter = 1; iter <= opts.maxIterations; iter++) {
    console.log(`\n--- Iteration ${iter}/${opts.maxIterations} ---`)
    const result = await runIngest(name)
    const combined = result.stdout + '\n' + result.stderr
    process.stdout.write(result.stdout)
    if (result.exitCode === 0) {
      console.log(`\n✅ ${name} validated cleanly`)
      return
    }

    const config = await loadConfig(name)
    let configChanged = false

    if (hasCurvatureSpike(combined) || hasClosureError(combined)) {
      console.log('⛔ structural issue (curvature/closure) — manual intervention required')
      process.stderr.write(result.stderr)
      process.exit(1)
    }

    if (hasSectorBandError(combined) && opts.acceptSectorSplits) {
      if (!config.sectorSplits) {
        config.sectorSplits = [0.33, 0.66]
        console.log('  → setting fallback sectorSplits [0.33, 0.66]')
        configChanged = true
      }
    }

    if (hasLengthError(combined) && opts.lengthMatchOSM) {
      const len = parseTrackLength(combined)
      if (len && Math.abs(len - config.expectedTrackLengthMeters) / config.expectedTrackLengthMeters > 0.03) {
        console.log(
          `  → updating expectedTrackLengthMeters: ${config.expectedTrackLengthMeters} → ${len}`,
        )
        config.expectedTrackLengthMeters = len
        configChanged = true
      }
    }

    if (hasHeadingError(combined) && opts.acceptHeading) {
      const h = parseStartHeading(combined)
      if (h != null) {
        console.log(
          `  → updating expectedStartHeadingDegrees: ${config.expectedStartHeadingDegrees} → ${h}`,
        )
        config.expectedStartHeadingDegrees = h
        configChanged = true
      }
    }

    if (!configChanged) {
      console.log('⛔ no auto-fixable critical issue in output — manual intervention required')
      console.log('--- STDERR ---')
      process.stderr.write(result.stderr)
      console.log('--- DEBUG ---')
      console.log('hasSectorBandError:', hasSectorBandError(combined))
      console.log('hasLengthError:', hasLengthError(combined))
      console.log('hasHeadingError:', hasHeadingError(combined))
      console.log('hasCurvatureSpike:', hasCurvatureSpike(combined))
      console.log('hasClosureError:', hasClosureError(combined))
      process.exit(1)
    }

    await writeConfig(name, config)
  }
  console.log(`\n⛔ ${name} failed to validate after ${opts.maxIterations} iterations`)
  process.exit(1)
}

const name = process.argv[2]
if (!name) {
  console.error('Usage: bun run scripts/track-auto-tune.ts <name>')
  process.exit(1)
}
await tune(name, DEFAULTS)
