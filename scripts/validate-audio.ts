import { join } from 'node:path'
import { rename, copyFile } from 'node:fs/promises'

const AUDIO_DIR = join(import.meta.dir, '..', 'public/audio')

const ON_THROTTLE = ['idle', 'rpm_3k', 'rpm_5k', 'rpm_7k', 'rpm_9k', 'rpm_11k', 'rpm_13k']
const OFF_THROTTLE = ['off_idle', 'off_3k', 'off_5k', 'off_7k', 'off_9k', 'off_11k', 'off_13k']
const EFFECTS = [
  'tire_screech',
  'wind',
  'rain_ambient',
  'rain_on_car',
  'rain_road_spray',
  'brake_squeal',
  'grass_rumble',
  'curb_bump',
  'gravel_crunch',
]

const RMS_THRESHOLD = 0.001
const CENTROID_MIN_DIFF_HZ = 100

async function decodeToPcm(filePath: string): Promise<Float32Array> {
  const proc = Bun.spawn(
    ['ffmpeg', '-i', filePath, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '1', '-ar', '44100', 'pipe:1'],
    { stdout: 'pipe', stderr: 'ignore' },
  )
  const buf = await new Response(proc.stdout).arrayBuffer()
  await proc.exited
  return new Float32Array(buf)
}

async function getSpectralCentroid(filePath: string): Promise<number> {
  const proc = Bun.spawn(
    [
      'ffmpeg', '-i', filePath,
      '-af', 'aspectralstats=win_size=4096,ametadata=print:key=lavfi.aspectralstats.1.centroid',
      '-f', 'null', '-',
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  )

  const stderr = await new Response(proc.stderr).text()
  await proc.exited

  const matches = stderr.match(/lavfi\.aspectralstats\.1\.centroid=(\d+\.?\d*)/g)
  if (!matches || matches.length === 0) return 0

  let sum = 0
  for (const m of matches) {
    sum += parseFloat(m.split('=')[1])
  }
  return sum / matches.length
}

function computeRms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

interface CentroidEntry {
  name: string
  centroid: number
}

async function measureEngineGroup(names: string[]): Promise<CentroidEntry[]> {
  const entries: CentroidEntry[] = []
  for (const name of names) {
    const path = join(AUDIO_DIR, 'engine', `${name}.mp3`)
    if (!(await Bun.file(path).exists())) continue
    const centroid = await getSpectralCentroid(path)
    entries.push({ name, centroid })
  }
  return entries
}

interface ValidationResult {
  errors: string[]
}

async function validateEngineGroup(names: string[], label: string): Promise<ValidationResult> {
  const errors: string[] = []
  const centroids: CentroidEntry[] = []

  for (const name of names) {
    const path = join(AUDIO_DIR, 'engine', `${name}.mp3`)
    const file = Bun.file(path)
    if (!(await file.exists())) {
      errors.push(`MISSING: engine/${name}.mp3`)
      continue
    }

    const pcm = await decodeToPcm(path)
    if (pcm.length === 0) {
      errors.push(`EMPTY: engine/${name}.mp3 — decoded to 0 samples`)
      continue
    }

    const rms = computeRms(pcm)
    if (rms < RMS_THRESHOLD) {
      errors.push(`SILENT: engine/${name}.mp3 — RMS ${rms.toFixed(6)} < ${RMS_THRESHOLD}`)
    }

    const centroid = await getSpectralCentroid(path)
    centroids.push({ name, centroid })
    console.log(`  ${label} ${name}: centroid ${centroid.toFixed(1)} Hz, RMS ${rms.toFixed(4)}`)
  }

  for (let i = 1; i < centroids.length; i++) {
    const prev = centroids[i - 1]
    const curr = centroids[i]
    const diff = curr.centroid - prev.centroid

    if (diff < CENTROID_MIN_DIFF_HZ) {
      errors.push(
        `CENTROID_ORDER: ${label} ${prev.name} (${prev.centroid.toFixed(1)} Hz) → ${curr.name} (${curr.centroid.toFixed(1)} Hz) — diff ${diff.toFixed(1)} Hz < ${CENTROID_MIN_DIFF_HZ} Hz`,
      )
    }
  }

  return { errors }
}

async function validateEffects(): Promise<ValidationResult> {
  const errors: string[] = []

  for (const name of EFFECTS) {
    const path = join(AUDIO_DIR, 'effects', `${name}.mp3`)
    const file = Bun.file(path)
    if (!(await file.exists())) {
      errors.push(`MISSING: effects/${name}.mp3`)
      continue
    }

    const pcm = await decodeToPcm(path)
    if (pcm.length === 0) {
      errors.push(`EMPTY: effects/${name}.mp3 — decoded to 0 samples`)
      continue
    }

    const rms = computeRms(pcm)
    if (rms < RMS_THRESHOLD) {
      errors.push(`SILENT: effects/${name}.mp3 — RMS ${rms.toFixed(6)} < ${RMS_THRESHOLD}`)
    } else {
      console.log(`  PASS effects/${name}.mp3 — RMS ${rms.toFixed(4)}`)
    }
  }

  return { errors }
}

async function runFullValidation(): Promise<number> {
  console.log('\n=== Audio Spectral Validation ===\n')

  let totalErrors = 0

  console.log('[On-Throttle]')
  const onResult = await validateEngineGroup(ON_THROTTLE, 'ON')
  onResult.errors.forEach(e => console.log(`  FAIL ${e}`))
  totalErrors += onResult.errors.length

  console.log('\n[Off-Throttle]')
  const offResult = await validateEngineGroup(OFF_THROTTLE, 'OFF')
  offResult.errors.forEach(e => console.log(`  FAIL ${e}`))
  totalErrors += offResult.errors.length

  console.log('\n[Effects]')
  const effectsResult = await validateEffects()
  effectsResult.errors.forEach(e => console.log(`  FAIL ${e}`))
  totalErrors += effectsResult.errors.length

  console.log(
    `\n=== Result: ${totalErrors === 0 ? 'ALL PASSED' : `${totalErrors} error(s)`} ===\n`,
  )

  return totalErrors
}

async function sortEngineGroup(names: string[], label: string) {
  console.log(`\n[${label}] Measuring centroids...`)
  const entries = await measureEngineGroup(names)

  if (entries.length !== names.length) {
    console.log(`  ERROR: expected ${names.length} files, found ${entries.length}. Skipping sort.`)
    return
  }

  for (const e of entries) {
    console.log(`  ${e.name}: ${e.centroid.toFixed(1)} Hz`)
  }

  const sorted = [...entries].sort((a, b) => a.centroid - b.centroid)

  let needsSwap = false
  for (let i = 0; i < names.length; i++) {
    if (sorted[i].name !== names[i]) {
      needsSwap = true
      break
    }
  }

  if (!needsSwap) {
    console.log(`  Already in order.`)
    return
  }

  console.log(`\n  Reordering:`)
  for (let i = 0; i < names.length; i++) {
    console.log(`    ${names[i]} ← ${sorted[i].name} (${sorted[i].centroid.toFixed(1)} Hz)`)
  }

  const tmpDir = join(AUDIO_DIR, 'engine', '.sort-tmp')
  await Bun.spawn(['mkdir', '-p', tmpDir]).exited

  for (const entry of entries) {
    const src = join(AUDIO_DIR, 'engine', `${entry.name}.mp3`)
    const dst = join(tmpDir, `${entry.name}.mp3`)
    await copyFile(src, dst)
  }

  for (let i = 0; i < names.length; i++) {
    const src = join(tmpDir, `${sorted[i].name}.mp3`)
    const dst = join(AUDIO_DIR, 'engine', `${names[i]}.mp3`)
    await copyFile(src, dst)
  }

  await Bun.spawn(['rm', '-rf', tmpDir]).exited
  console.log(`  Done.`)
}

async function runSort() {
  await sortEngineGroup(ON_THROTTLE, 'On-Throttle')
  await sortEngineGroup(OFF_THROTTLE, 'Off-Throttle')

  console.log('\n--- Validation after sort ---')
  const errors = await runFullValidation()
  process.exit(errors > 0 ? 1 : 0)
}

async function main() {
  const cmd = process.argv[2] ?? 'validate'

  switch (cmd) {
    case 'validate': {
      const errors = await runFullValidation()
      process.exit(errors > 0 ? 1 : 0)
      break
    }
    case 'sort':
      await runSort()
      break
    default:
      console.log(`Usage: bun scripts/validate-audio.ts [validate|sort]`)
      console.log(`  validate  Check spectral ordering + RMS (default)`)
      console.log(`  sort      Sort engine samples by spectral centroid`)
  }
}

main()
