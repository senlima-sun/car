import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import 'dotenv/config'

const elevenlabs = new ElevenLabsClient()

const AUDIO_DIR = join(import.meta.dir, 'public/audio')

type Category = 'engine' | 'effects'

interface SoundSpec {
  category: Category
  name: string
  prompt: string
  durationSeconds: number
  loop: boolean
  promptInfluence?: number
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0)
  const buf = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buf.set(chunk, offset)
    offset += chunk.length
  }
  return buf
}

async function generate(spec: SoundSpec): Promise<string> {
  const dir = join(AUDIO_DIR, spec.category)
  await mkdir(dir, { recursive: true })

  const outPath = join(dir, `${spec.name}.mp3`)
  const exists = await Bun.file(outPath).exists()
  if (exists) {
    console.log(`  SKIP ${spec.category}/${spec.name}.mp3 (already exists)`)
    return outPath
  }

  console.log(`  GEN  ${spec.category}/${spec.name}.mp3 — "${spec.prompt.slice(0, 60)}..."`)

  const stream = await elevenlabs.textToSoundEffects.convert({
    text: spec.prompt,
    outputFormat: 'mp3_44100_128',
    durationSeconds: spec.durationSeconds,
    loop: spec.loop,
    promptInfluence: spec.promptInfluence ?? 0.4,
  })

  const data = await streamToBuffer(stream)

  if (data.length < 1024) {
    console.warn(`  WARN ${spec.name}.mp3 is suspiciously small (${data.length} bytes)`)
  }

  const rawPath = outPath + '.raw'
  await Bun.write(rawPath, data)

  const reencode = Bun.spawn(
    [
      'ffmpeg',
      '-y',
      '-i',
      rawPath,
      '-acodec',
      'pcm_s16le',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-f',
      'wav',
      'pipe:1',
    ],
    { stdout: 'pipe', stderr: 'ignore' },
  )
  const wavData = await new Response(reencode.stdout).arrayBuffer()
  await reencode.exited

  const encode = Bun.spawn(
    [
      'ffmpeg',
      '-y',
      '-i',
      'pipe:0',
      '-codec:a',
      'libmp3lame',
      '-q:a',
      '2',
      '-ar',
      '44100',
      outPath,
    ],
    { stdin: new Uint8Array(wavData), stdout: 'ignore', stderr: 'ignore' },
  )
  await encode.exited

  await Bun.file(rawPath).delete()

  const finalSize = Bun.file(outPath).size
  console.log(`  OK   ${spec.category}/${spec.name}.mp3 (${(finalSize / 1024).toFixed(1)} KB)`)
  return outPath
}

const ENGINE_ON_THROTTLE: SoundSpec[] = [
  {
    category: 'engine',
    name: 'idle',
    prompt:
      'Formula 1 V6 turbo-hybrid engine idling at 800 RPM, low rumble with turbo whine, steady loop, no crowd noise',
    durationSeconds: 3,
    loop: true,
    promptInfluence: 0.5,
  },
  {
    category: 'engine',
    name: 'rpm_3k',
    prompt:
      'Formula 1 V6 turbo-hybrid engine at 3000 RPM under throttle, moderate growl with turbo spool, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'rpm_5k',
    prompt:
      'Formula 1 V6 turbo-hybrid engine at 5000 RPM full throttle, aggressive exhaust note, turbo whistle, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'rpm_7k',
    prompt:
      'Formula 1 V6 turbo-hybrid engine at 7000 RPM full throttle, high-pitched exhaust scream, intense turbo, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'rpm_9k',
    prompt:
      'Formula 1 V6 turbo-hybrid engine at 9000 RPM full throttle, screaming exhaust, maximum turbo whine, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'rpm_11k',
    prompt:
      'Formula 1 V6 turbo-hybrid engine at 11000 RPM full throttle, very high-pitched scream, intense mechanical noise, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'rpm_13k',
    prompt:
      'Formula 1 V6 turbo-hybrid engine at 13000 RPM redline, maximum pitch scream, aggressive raspy exhaust, steady loop',
    durationSeconds: 3,
    loop: true,
  },
]

const ENGINE_OFF_THROTTLE: SoundSpec[] = [
  {
    category: 'engine',
    name: 'off_idle',
    prompt:
      'Formula 1 V6 turbo-hybrid engine coasting at idle RPM, off-throttle, turbo flutter and blow-off, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'off_3k',
    prompt:
      'Formula 1 engine braking at 3000 RPM, off-throttle deceleration, turbo blow-off, popping exhaust overrun, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'off_5k',
    prompt:
      'Formula 1 engine braking at 5000 RPM, off-throttle deceleration, exhaust crackle and pop, turbo wastegate, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'off_7k',
    prompt:
      'Formula 1 engine braking at 7000 RPM, off-throttle deceleration, high exhaust crackle, turbo flutter, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'off_9k',
    prompt:
      'Formula 1 engine braking at 9000 RPM, off-throttle deceleration, intense exhaust pops and crackle, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'off_11k',
    prompt:
      'Formula 1 engine braking at 11000 RPM, off-throttle deceleration, harsh exhaust overrun, high-pitched crackle, steady loop',
    durationSeconds: 3,
    loop: true,
  },
  {
    category: 'engine',
    name: 'off_13k',
    prompt:
      'Formula 1 engine braking at 13000 RPM redline, off-throttle deceleration, maximum exhaust crackle and pops, steady loop',
    durationSeconds: 3,
    loop: true,
  },
]

const EFFECTS: SoundSpec[] = [
  {
    category: 'effects',
    name: 'tire_screech',
    prompt:
      'Tire screech on dry asphalt, race car locking brakes and sliding, high friction squeal, steady loop',
    durationSeconds: 3,
    loop: true,
    promptInfluence: 0.5,
  },
  {
    category: 'effects',
    name: 'wind',
    prompt:
      'High speed wind noise at 200 km/h, aerodynamic rush over a car body, no engine noise, steady loop',
    durationSeconds: 4,
    loop: true,
  },
  {
    category: 'effects',
    name: 'rain_ambient',
    prompt: 'Heavy rain ambience outdoors, rainfall on pavement, no thunder, steady loop',
    durationSeconds: 4,
    loop: true,
  },
  {
    category: 'effects',
    name: 'rain_on_car',
    prompt:
      'Rain hitting a metal car body and roof, raindrops on metal surface, interior perspective, steady loop',
    durationSeconds: 4,
    loop: true,
  },
  {
    category: 'effects',
    name: 'rain_road_spray',
    prompt:
      'Car tire spray on wet road, water splashing from tires at high speed, hydroplaning sounds, steady loop',
    durationSeconds: 4,
    loop: true,
  },
  {
    category: 'effects',
    name: 'brake_squeal',
    prompt:
      'Carbon-ceramic brake disc squeal under hard braking, high-pitched metallic screech, Formula 1 race car, steady loop',
    durationSeconds: 3,
    loop: true,
    promptInfluence: 0.5,
  },
  {
    category: 'effects',
    name: 'grass_rumble',
    prompt:
      'Race car tires rolling over grass at speed, low-frequency rumble, dirt and turf vibrations, steady loop',
    durationSeconds: 4,
    loop: true,
  },
  {
    category: 'effects',
    name: 'curb_bump',
    prompt:
      'Race car hitting a curb stone, sharp mechanical impact, suspension thud, single hit with reverb tail',
    durationSeconds: 1.5,
    loop: false,
    promptInfluence: 0.5,
  },
  {
    category: 'effects',
    name: 'gravel_crunch',
    prompt:
      'Car tires on gravel surface, stones crunching and popping under wheels at speed, rally gravel trap, steady loop',
    durationSeconds: 4,
    loop: true,
  },
]

const ALL_SPECS: SoundSpec[] = [...ENGINE_ON_THROTTLE, ...ENGINE_OFF_THROTTLE, ...EFFECTS]

async function validateFile(path: string, spec: SoundSpec): Promise<string[]> {
  const issues: string[] = []
  const file = Bun.file(path)
  const exists = await file.exists()
  if (!exists) {
    issues.push(`MISSING: ${path}`)
    return issues
  }

  const size = file.size
  if (size < 2048) {
    issues.push(`TOO_SMALL: ${path} (${size} bytes) — likely empty or corrupt`)
  }

  const bytes = await file.bytes()
  const header = bytes.slice(0, 3)
  const isMP3 =
    (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) ||
    (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33)
  if (!isMP3) {
    issues.push(
      `NOT_MP3: ${path} — header bytes: ${Array.from(header)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ')}`,
    )
  }

  const minExpectedBytes = ((spec.durationSeconds * 128 * 1000) / 8) * 0.5
  if (size < minExpectedBytes) {
    issues.push(
      `SHORT: ${path} — ${size} bytes, expected >=${Math.round(minExpectedBytes)} for ${spec.durationSeconds}s@128kbps`,
    )
  }

  return issues
}

async function runValidation() {
  console.log('\n--- Validation ---\n')
  let totalIssues = 0

  for (const spec of ALL_SPECS) {
    const path = join(AUDIO_DIR, spec.category, `${spec.name}.mp3`)
    const issues = await validateFile(path, spec)
    if (issues.length > 0) {
      totalIssues += issues.length
      issues.forEach(i => console.log(`  FAIL ${i}`))
    } else {
      console.log(`  PASS ${spec.category}/${spec.name}.mp3`)
    }
  }

  console.log(`\n${totalIssues === 0 ? 'All files valid.' : `${totalIssues} issue(s) found.`}\n`)
  return totalIssues
}

async function generateCategory(specs: SoundSpec[], label: string) {
  console.log(`\n[${label}] Generating ${specs.length} files...\n`)
  const results: string[] = []
  for (const spec of specs) {
    try {
      const path = await generate(spec)
      results.push(path)
    } catch (err) {
      console.error(`  ERR  ${spec.category}/${spec.name}.mp3 — ${err}`)
    }
  }
  return results
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] ?? 'all'

  switch (cmd) {
    case 'validate': {
      const issues = await runValidation()
      process.exit(issues > 0 ? 1 : 0)
      break
    }

    case 'engine-on':
      await generateCategory(ENGINE_ON_THROTTLE, 'On-Throttle')
      await runValidation()
      break

    case 'engine-off':
      await generateCategory(ENGINE_OFF_THROTTLE, 'Off-Throttle')
      await runValidation()
      break

    case 'engine':
      await generateCategory(ENGINE_ON_THROTTLE, 'On-Throttle')
      await generateCategory(ENGINE_OFF_THROTTLE, 'Off-Throttle')
      await runValidation()
      break

    case 'effects':
      await generateCategory(EFFECTS, 'Effects')
      await runValidation()
      break

    case 'all':
      await generateCategory(ENGINE_ON_THROTTLE, 'On-Throttle')
      await generateCategory(ENGINE_OFF_THROTTLE, 'Off-Throttle')
      await generateCategory(EFFECTS, 'Effects')
      await runValidation()
      break

    case 'regen': {
      const target = args[1]
      if (!target) {
        console.error('Usage: bun generate-se.ts regen <category/name>')
        console.error('Example: bun generate-se.ts regen engine/idle')
        process.exit(1)
      }
      const [cat, name] = target.split('/')
      const spec = ALL_SPECS.find(s => s.category === cat && s.name === name)
      if (!spec) {
        console.error(`Unknown sound: ${target}`)
        console.error('Available:', ALL_SPECS.map(s => `${s.category}/${s.name}`).join(', '))
        process.exit(1)
      }
      const path = join(AUDIO_DIR, spec.category, `${spec.name}.mp3`)
      const file = Bun.file(path)
      if (await file.exists()) {
        await file.delete()
        console.log(`  DEL  ${target}.mp3`)
      }
      await generate(spec)
      await runValidation()
      break
    }

    default:
      console.log(`
Usage: bun generate-se.ts [command]

Commands:
  all          Generate all sounds (default, skips existing)
  engine       Generate all engine sounds
  engine-on    Generate on-throttle engine sounds
  engine-off   Generate off-throttle engine sounds
  effects      Generate effect sounds
  validate     Validate existing files
  regen <cat/name>  Re-generate a specific sound (deletes existing first)
                    Example: bun generate-se.ts regen engine/idle
`)
  }
}

main()
