import { join } from 'node:path'

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
const FREQUENCY_MIN_DIFF_HZ = 100

async function decodeToPcm(filePath: string): Promise<Float32Array> {
  const proc = Bun.spawn(
    [
      'ffmpeg',
      '-i',
      filePath,
      '-f',
      'f32le',
      '-acodec',
      'pcm_f32le',
      '-ac',
      '1',
      '-ar',
      '44100',
      'pipe:1',
    ],
    { stdout: 'pipe', stderr: 'ignore' },
  )
  const buf = await new Response(proc.stdout).arrayBuffer()
  await proc.exited
  return new Float32Array(buf)
}

function nextPow2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  if (n <= 1) return

  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    while (j & bit) {
      j ^= bit
      bit >>= 1
    }
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < halfLen; k++) {
        const evenIdx = i + k
        const oddIdx = i + k + halfLen
        const tRe = curRe * re[oddIdx] - curIm * im[oddIdx]
        const tIm = curRe * im[oddIdx] + curIm * re[oddIdx]
        re[oddIdx] = re[evenIdx] - tRe
        im[oddIdx] = im[evenIdx] - tIm
        re[evenIdx] += tRe
        im[evenIdx] += tIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

function dominantFrequency(samples: Float32Array, sampleRate: number): number {
  const n = nextPow2(samples.length)
  const re = new Float64Array(n)
  const im = new Float64Array(n)

  for (let i = 0; i < samples.length; i++) re[i] = samples[i]

  fft(re, im)

  let maxMag = 0
  let maxBin = 0
  const halfN = n >> 1
  const minBin = Math.ceil((80 * n) / sampleRate)

  for (let i = minBin; i < halfN; i++) {
    const mag = re[i] * re[i] + im[i] * im[i]
    if (mag > maxMag) {
      maxMag = mag
      maxBin = i
    }
  }

  return (maxBin * sampleRate) / n
}

function computeRms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

interface ValidationResult {
  errors: string[]
  warnings: string[]
}

async function validateEngineGroup(names: string[], label: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const freqs: { name: string; freq: number }[] = []

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

    const freq = dominantFrequency(pcm, 44100)
    freqs.push({ name, freq })
    console.log(`  ${label} ${name}: dominant ${freq.toFixed(1)} Hz, RMS ${rms.toFixed(4)}`)
  }

  for (let i = 1; i < freqs.length; i++) {
    const prev = freqs[i - 1]
    const curr = freqs[i]
    const diff = curr.freq - prev.freq

    if (diff < FREQUENCY_MIN_DIFF_HZ) {
      errors.push(
        `FREQ_ORDER: ${label} ${prev.name} (${prev.freq.toFixed(1)} Hz) → ${curr.name} (${curr.freq.toFixed(1)} Hz) — diff ${diff.toFixed(1)} Hz < ${FREQUENCY_MIN_DIFF_HZ} Hz`,
      )
    }
  }

  return { errors, warnings }
}

async function validateEffects(): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

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

  return { errors, warnings }
}

async function main() {
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

  process.exit(totalErrors > 0 ? 1 : 0)
}

main()
