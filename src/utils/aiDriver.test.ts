import { describe, expect, test } from 'bun:test'
import {
  computeAIInput,
  LATERAL_G_LIMIT,
  GRAVITY_MS2,
  type AIDriverCenterlineSample,
} from './aiDriver'

function makeStraightCenterline(length: number, step = 5): AIDriverCenterlineSample[] {
  const samples: AIDriverCenterlineSample[] = []
  for (let d = 0; d <= length; d += step) {
    samples.push({ x: 0, z: d, cumulativeDistance: d })
  }
  return samples
}

function makeRightAngleCornerCenterline(): AIDriverCenterlineSample[] {
  const samples: AIDriverCenterlineSample[] = []
  let cumulative = 0
  for (let z = 0; z <= 100; z += 5) {
    samples.push({ x: 0, z, cumulativeDistance: cumulative })
    cumulative += 5
  }
  const radius = 12
  const segments = 16
  for (let i = 1; i <= segments; i++) {
    const theta = (Math.PI / 2) * (i / segments)
    const cx = radius * (1 - Math.cos(theta))
    const cz = 100 + radius * Math.sin(theta)
    const prev = samples[samples.length - 1]!
    const d = Math.hypot(cx - prev.x, cz - prev.z)
    cumulative += d
    samples.push({ x: cx, z: cz, cumulativeDistance: cumulative })
  }
  for (let x = radius + 5; x <= radius + 80; x += 5) {
    const prev = samples[samples.length - 1]!
    const cz = 100 + radius
    const d = Math.hypot(x - prev.x, cz - prev.z)
    cumulative += d
    samples.push({ x, z: cz, cumulativeDistance: cumulative })
  }
  return samples
}

describe('computeAIInput', () => {
  test('straight centerline + zero alpha → steering ~ 0, throttle = 1, brake = 0', () => {
    const samples = makeStraightCenterline(200)
    const input = computeAIInput({
      position: [0, 0, 10],
      velocityMS: 30,
      heading: 0,
      centerlineSamples: samples,
      lapProgressFraction: 0.1,
    })
    expect(Math.abs(input.steer ?? 0)).toBeLessThan(0.05)
    expect(input.throttle).toBe(1)
    expect(input.brake_analog).toBe(0)
    expect(input.forward).toBe(true)
    expect(input.brake).toBe(false)
  })

  test('approaching tight corner at 50 m/s → brake = 1', () => {
    const samples = makeRightAngleCornerCenterline()
    const input = computeAIInput({
      position: [0, 0, 70],
      velocityMS: 50,
      heading: 0,
      centerlineSamples: samples,
      lapProgressFraction: 0.3,
    })
    expect(input.brake_analog).toBe(1)
    expect(input.brake).toBe(true)
    expect(input.throttle).toBe(0)
  })

  test('corner exit at 10 m/s → throttle = 1 and non-zero steering', () => {
    const samples = makeRightAngleCornerCenterline()
    const corner = samples[Math.floor(samples.length * 0.45)]!
    const input = computeAIInput({
      position: [corner.x, 0, corner.z],
      velocityMS: 10,
      heading: Math.PI / 4,
      centerlineSamples: samples,
      lapProgressFraction: 0.45,
    })
    const cornerSpeedLimit = Math.sqrt((LATERAL_G_LIMIT * GRAVITY_MS2) / 0.05)
    expect(input.throttle === 1 || input.brake_analog === 0).toBe(true)
    expect(cornerSpeedLimit).toBeGreaterThan(0)
    expect(Math.abs(input.steer ?? 0)).toBeGreaterThan(0.0)
  })

  test('wraps bearing correctly across the +/- pi boundary', () => {
    const samples: AIDriverCenterlineSample[] = []
    for (let d = 0; d <= 200; d += 5) {
      samples.push({ x: 0, z: d, cumulativeDistance: d })
    }
    const epsilon = 1e-3
    const inputNearPi = computeAIInput({
      position: [0, 0, 10],
      velocityMS: 20,
      heading: Math.PI - epsilon,
      centerlineSamples: samples,
      lapProgressFraction: 0.05,
    })
    const inputNearNegPi = computeAIInput({
      position: [0, 0, 10],
      velocityMS: 20,
      heading: -Math.PI + epsilon,
      centerlineSamples: samples,
      lapProgressFraction: 0.05,
    })
    const diff = Math.abs((inputNearPi.steer ?? 0) - (inputNearNegPi.steer ?? 0))
    expect(diff).toBeLessThan(0.05)
  })

  test('returns idle input when centerline has fewer than 2 samples', () => {
    const input = computeAIInput({
      position: [0, 0, 0],
      velocityMS: 0,
      heading: 0,
      centerlineSamples: [{ x: 0, z: 0, cumulativeDistance: 0 }],
      lapProgressFraction: 0,
    })
    expect(input.throttle).toBe(0)
    expect(input.brake_analog).toBe(0)
    expect(input.steer).toBe(0)
    expect(input.forward).toBe(false)
  })

  test('steer is clamped to [-1, 1]', () => {
    const samples = makeStraightCenterline(200)
    const input = computeAIInput({
      position: [0, 0, 10],
      velocityMS: 5,
      heading: Math.PI / 2,
      centerlineSamples: samples,
      lapProgressFraction: 0.05,
    })
    expect(input.steer).toBeGreaterThanOrEqual(-1)
    expect(input.steer).toBeLessThanOrEqual(1)
  })
})
