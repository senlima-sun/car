/**
 * Phase 1.4 microbenchmark for stampRibbonsIntoBaseline.
 *
 * Run via:
 *   bun run apps/game/src/utils/terrainStamp.bench.ts --bench
 *
 * Default-off: bare `bun run apps/game/src/utils/terrainStamp.bench.ts`
 * is a no-op. The `--bench` guard prevents `bun test` from picking
 * this up as a test file.
 *
 * Budget: <100ms median for a Spa-class circuit (256² grid, 450-segment
 * ribbon). Recorded landing-time figure inline below.
 *
 * Last recorded (2026-05-21, Apple Silicon, Bun 1.3.14):
 *   min:    91.42 ms
 *   median: 91.83 ms
 *   max:   101.71 ms
 */
import {
  DEFAULT_STAMP_CONFIG,
  ribbonStampInputsFromObjects,
  stampRibbonsIntoBaseline,
} from './terrainStamp'
import type { TrackRibbonPoint } from '../types/trackObjects'

const RES = 256
const WORLD = 4000
const RIBBON_LENGTH = 7000 // ~7km closed loop (Spa is ~7km)
const RIBBON_SEGMENTS = 450

function makeSyntheticDem(): Float32Array {
  const arr = new Float32Array(RES * RES)
  const cell = WORLD / (RES - 1)
  const half = WORLD / 2
  for (let gz = 0; gz < RES; gz++) {
    for (let gx = 0; gx < RES; gx++) {
      const x = -half + gx * cell
      const z = -half + gz * cell
      arr[gz * RES + gx] =
        50 * Math.sin(x * 0.002) +
        30 * Math.cos(z * 0.003) +
        10 * Math.sin((x + z) * 0.005)
    }
  }
  return arr
}

function makeSpaSizedRibbon(): {
  type: string
  ribbonPoints: TrackRibbonPoint[]
  ribbonClosed: boolean
  width: number
} {
  const points: TrackRibbonPoint[] = []
  for (let i = 0; i < RIBBON_SEGMENTS; i++) {
    // Lazy rolling closed loop within a 3km bounding box, total ≈ 7km.
    const t = (i / RIBBON_SEGMENTS) * Math.PI * 2
    points.push({
      x: Math.cos(t) * 1200 + Math.cos(t * 3) * 200,
      y: 0,
      z: Math.sin(t) * 1100 + Math.sin(t * 5) * 150,
      isPitLane: false,
    })
  }
  void RIBBON_LENGTH
  return {
    type: 'track_ribbon',
    ribbonPoints: points,
    ribbonClosed: true,
    width: 12,
  }
}

function bench(): void {
  const raw = makeSyntheticDem()
  const ribbon = makeSpaSizedRibbon()
  const ribbons = ribbonStampInputsFromObjects([ribbon], 12)

  // Warm up.
  stampRibbonsIntoBaseline(raw, RES, WORLD, ribbons, DEFAULT_STAMP_CONFIG)

  const N = 5
  const times: number[] = []
  for (let i = 0; i < N; i++) {
    const start = performance.now()
    stampRibbonsIntoBaseline(raw, RES, WORLD, ribbons, DEFAULT_STAMP_CONFIG)
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  const min = times[0]!
  const median = times[Math.floor(N / 2)]!
  const max = times[N - 1]!
  console.log(
    `stampRibbonsIntoBaseline (${RES}² grid, ${ribbon.ribbonPoints.length} ribbon points):`,
  )
  console.log(`  min:    ${min.toFixed(2)} ms`)
  console.log(`  median: ${median.toFixed(2)} ms  (budget <100ms)`)
  console.log(`  max:    ${max.toFixed(2)} ms`)
  if (median > 100) {
    console.warn('[bench] median over 100ms budget — consider spatial index.')
  }
}

if (process.argv.includes('--bench')) bench()
