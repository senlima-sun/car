import { readFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CircuitConfigFile } from './circuits/_schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const CIRCUITS_DIR = join(REPO_ROOT, 'scripts', 'circuits')
const CACHE_DIR = join(REPO_ROOT, '.cache', 'track-validation')

const MAX_VALIDATION_DRIVE_SECONDS = 600
const POLL_INTERVAL_MS = 2_000
const WALL_CLOCK_TIMEOUT_MS = (MAX_VALIDATION_DRIVE_SECONDS + 30) * 1000
const DEV_SERVER_URL = 'http://localhost:3000'

const aiDriveTrackIds: Record<string, string> = {
  silverstone: 'f1_silverstone_circuit',
  suzuka: 'f1_suzuka',
  monza: 'f1_monza',
  shanghai: 'f1_shanghai',
}

interface ValidationRunSummary {
  trackId: string
  phase: 'completed' | 'failed'
  lapTimeSeconds: number | null
  offTrackSeconds: number
  failureReason: string | null
  replayId: string | null
}

async function loadConfig(name: string): Promise<CircuitConfigFile> {
  const path = join(CIRCUITS_DIR, `${name}.config.json`)
  const raw = await readFile(path, 'utf-8')
  return JSON.parse(raw) as CircuitConfigFile
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

async function runAgentBrowser(args: string[]): Promise<{ stdout: string; ok: boolean }> {
  const proc = Bun.spawn(['agent-browser', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const code = await proc.exited
  if (code !== 0) {
    process.stderr.write(stderr)
  }
  return { stdout, ok: code === 0 }
}

async function pollForResult(): Promise<ValidationRunSummary | null> {
  const deadline = Date.now() + WALL_CLOCK_TIMEOUT_MS
  while (Date.now() < deadline) {
    const { stdout, ok } = await runAgentBrowser([
      'eval',
      'JSON.stringify(window.__VALIDATION_DRIVE_RESULT__ ?? null)',
    ])
    if (ok) {
      const trimmed = stdout.trim()
      if (trimmed && trimmed !== 'null' && trimmed !== '"null"') {
        try {
          const parsed = JSON.parse(trimmed) as ValidationRunSummary | null
          if (parsed) return parsed
        } catch {
          // Continue polling
        }
      }
    }
    await Bun.sleep(POLL_INTERVAL_MS)
  }
  return null
}

async function main(): Promise<void> {
  const circuit = process.argv[2]
  if (!circuit) {
    process.stderr.write('Usage: bun run track:ai-drive <circuit-name>\n')
    process.stderr.write(`Known circuits: ${Object.keys(aiDriveTrackIds).join(', ')}\n`)
    process.exit(1)
  }

  const trackId = aiDriveTrackIds[circuit]
  if (!trackId) {
    process.stderr.write(`unknown circuit: ${circuit}\n`)
    process.stderr.write(`known: ${Object.keys(aiDriveTrackIds).join(', ')}\n`)
    process.exit(1)
  }

  const config = await loadConfig(circuit)
  const [floorSeconds, ceilingSeconds] = config.aiDriveLapTimeWindowSeconds

  if (!(await devServerIsUp())) {
    process.stderr.write(`Dev server not running at ${DEV_SERVER_URL} — run \`bun run dev\`\n`)
    process.exit(1)
  }

  await mkdir(CACHE_DIR, { recursive: true })

  const openRes = await runAgentBrowser([
    'open',
    `${DEV_SERVER_URL}/?track=${trackId}`,
  ])
  if (!openRes.ok) {
    process.stderr.write(`agent-browser open failed\n`)
    process.exit(1)
  }

  await runAgentBrowser(['wait', '--load', 'networkidle'])

  const startRes = await runAgentBrowser([
    'eval',
    'window.__VALIDATION_DRIVE_START__ ? window.__VALIDATION_DRIVE_START__() : "NO_START_GLOBAL"',
  ])
  if (!startRes.ok || startRes.stdout.includes('NO_START_GLOBAL')) {
    process.stderr.write(
      `window.__VALIDATION_DRIVE_START__ is not present — is the dev build running?\n`,
    )
    await runAgentBrowser([
      'screenshot',
      join(CACHE_DIR, `${circuit}-no-start-global.png`),
    ])
    process.exit(1)
  }

  const summary = await pollForResult()

  if (!summary) {
    process.stderr.write(`AI drive timed out after ${WALL_CLOCK_TIMEOUT_MS / 1000}s\n`)
    await runAgentBrowser(['screenshot', join(CACHE_DIR, `${circuit}-timeout.png`)])
    process.exit(1)
  }

  const failures: string[] = []
  if (summary.phase !== 'completed') {
    failures.push(`phase is "${summary.phase}" (expected "completed")`)
  }
  if (summary.lapTimeSeconds === null) {
    failures.push('lapTimeSeconds is null')
  } else if (
    summary.lapTimeSeconds < floorSeconds ||
    summary.lapTimeSeconds > ceilingSeconds
  ) {
    failures.push(
      `lapTimeSeconds ${summary.lapTimeSeconds.toFixed(2)}s outside window [${floorSeconds}, ${ceilingSeconds}]`,
    )
  }
  if (summary.offTrackSeconds > 10) {
    failures.push(`offTrackSeconds ${summary.offTrackSeconds.toFixed(2)} exceeds 10s budget`)
  }

  if (failures.length > 0) {
    process.stderr.write(`AI drive FAILED for ${circuit}:\n`)
    for (const f of failures) process.stderr.write(`  - ${f}\n`)
    process.stderr.write(`Summary: ${JSON.stringify(summary, null, 2)}\n`)
    await runAgentBrowser([
      'screenshot',
      join(CACHE_DIR, `${circuit}-failure.png`),
    ])
    process.exit(1)
  }

  process.stdout.write(`AI drive OK: ${summary.lapTimeSeconds?.toFixed(2)}s\n`)
  process.exit(0)
}

await main()
