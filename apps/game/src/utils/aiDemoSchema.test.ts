import { describe, expect, it } from 'bun:test'
import {
  CURRENT_DEMO_SCHEMA_VERSION,
  ghostBuffersToDemo,
  type HumanDemoData,
} from './aiDemoSchema'
import {
  GHOST_SAMPLE_INTERVAL_MS,
  type GhostBuffers,
} from '@/stores/useGhostCarStore'

const makeBuffers = (n: number): GhostBuffers => {
  const positions = new Float32Array(n * 3)
  const rotations = new Float32Array(n * 4)
  const steerAngles = new Float32Array(n)
  const wheelRotations = new Float32Array(n * 4)
  const timestamps = new Float32Array(n)
  const throttles = new Float32Array(n)
  const brakes = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    positions[i * 3] = i
    positions[i * 3 + 1] = i * 0.5
    positions[i * 3 + 2] = -i
    rotations[i * 4] = 0
    rotations[i * 4 + 1] = 0
    rotations[i * 4 + 2] = 0
    rotations[i * 4 + 3] = 1
    steerAngles[i] = (i % 10) * 0.01
    wheelRotations[i * 4] = i * 0.1
    wheelRotations[i * 4 + 1] = i * 0.1
    wheelRotations[i * 4 + 2] = i * 0.1
    wheelRotations[i * 4 + 3] = i * 0.1
    timestamps[i] = i * GHOST_SAMPLE_INTERVAL_MS
    throttles[i] = (i % 100) / 100
    brakes[i] = 1 - (i % 100) / 100
  }
  return {
    frameCount: n,
    positions,
    rotations,
    steerAngles,
    wheelRotations,
    timestamps,
    throttles,
    brakes,
  }
}

describe('ghostBuffersToDemo', () => {
  it('produces a demo with correct shape and schemaVersion=1', () => {
    const buffers = makeBuffers(100)
    const demo = ghostBuffersToDemo('f1_monza', 87.345, buffers)

    expect(demo.schemaVersion).toBe(CURRENT_DEMO_SCHEMA_VERSION)
    expect(demo.schemaVersion).toBe(1)
    expect(demo.trackId).toBe('f1_monza')
    expect(demo.lapTime).toBe(87.345)
    expect(demo.frameCount).toBe(100)
    expect(demo.sampleIntervalMs).toBe(GHOST_SAMPLE_INTERVAL_MS)
  })

  it('emits arrays with lengths aligned to frameCount', () => {
    const buffers = makeBuffers(42)
    const demo = ghostBuffersToDemo('silverstone', 95.0, buffers)

    expect(demo.positions.length).toBe(42 * 3)
    expect(demo.rotations.length).toBe(42 * 4)
    expect(demo.steerAngles.length).toBe(42)
    expect(demo.wheelRotations.length).toBe(42 * 4)
    expect(demo.timestamps.length).toBe(42)
    expect(demo.throttles.length).toBe(42)
    expect(demo.brakes.length).toBe(42)
  })

  it('uses plain number arrays (JSON serializable)', () => {
    const buffers = makeBuffers(10)
    const demo = ghostBuffersToDemo('monza', 0, buffers)

    expect(Array.isArray(demo.positions)).toBe(true)
    expect(Array.isArray(demo.throttles)).toBe(true)
    expect(Array.isArray(demo.brakes)).toBe(true)
    expect(typeof demo.positions[0]).toBe('number')
  })

  it('round-trips through JSON.stringify and JSON.parse without loss', () => {
    const buffers = makeBuffers(50)
    const demo = ghostBuffersToDemo('f1_monza', 80.0, buffers)
    const json = JSON.stringify(demo)
    const decoded = JSON.parse(json) as HumanDemoData

    expect(decoded.schemaVersion).toBe(1)
    expect(decoded.trackId).toBe('f1_monza')
    expect(decoded.frameCount).toBe(50)
    expect(decoded.positions.length).toBe(150)
    expect(decoded.throttles.length).toBe(50)
    expect(decoded.brakes.length).toBe(50)
    expect(decoded.throttles[1]).toBeCloseTo(0.01, 5)
  })

  it('handles zero-frame buffers cleanly', () => {
    const buffers = makeBuffers(0)
    const demo = ghostBuffersToDemo('empty', 0, buffers)

    expect(demo.frameCount).toBe(0)
    expect(demo.positions.length).toBe(0)
    expect(demo.throttles.length).toBe(0)
    expect(demo.brakes.length).toBe(0)
  })

  it('preserves trackId verbatim (no slug rewriting)', () => {
    const buffers = makeBuffers(1)
    const demo = ghostBuffersToDemo('Some_Custom-Track.id', 1.0, buffers)
    expect(demo.trackId).toBe('Some_Custom-Track.id')
  })
})
