import { describe, expect, test } from 'bun:test'

import { validateHeightmap } from './validate'

const resolution = 32
const worldSize = 4000

function makeRamp(amplitudeM: number): Float32Array {
  const data = new Float32Array(resolution * resolution)
  for (let gz = 0; gz < resolution; gz++) {
    for (let gx = 0; gx < resolution; gx++) {
      data[gz * resolution + gx] = (gx / (resolution - 1)) * amplitudeM
    }
  }
  return data
}

function sampler(heightmap: Float32Array): (worldX: number, worldZ: number) => number {
  return (worldX, worldZ) => {
    const halfSize = worldSize / 2
    const cellSize = worldSize / (resolution - 1)
    const fx = (worldX + halfSize) / cellSize
    const fz = (worldZ + halfSize) / cellSize
    if (fx < 0 || fx >= resolution - 1 || fz < 0 || fz >= resolution - 1) return 0
    const gx = Math.floor(fx)
    const gz = Math.floor(fz)
    return heightmap[gz * resolution + gx]!
  }
}

describe('validateHeightmap', () => {
  test('passes for in-range, smooth, landmark-matching map', () => {
    const data = makeRamp(40)
    const report = validateHeightmap({
      heightmap: data,
      resolution,
      worldSize,
      sampleAt: sampler(data),
      options: {
        expectedRangeMeters: 40,
        landmarks: [
          { label: 'mid', worldX: 0, worldZ: 0, expectedHeight: 20, toleranceM: 2 },
        ],
      },
    })
    expect(report.pass).toBe(true)
    expect(report.reasons).toEqual([])
  })

  test('fails when all-zero', () => {
    const data = new Float32Array(resolution * resolution)
    const report = validateHeightmap({
      heightmap: data,
      resolution,
      worldSize,
      sampleAt: sampler(data),
      options: { expectedRangeMeters: 40 },
    })
    expect(report.pass).toBe(false)
    expect(report.reasons.some((r) => r.includes('all-zero'))).toBe(true)
  })

  test('fails when neighbour delta exceeds threshold', () => {
    const data = makeRamp(40)
    data[10 * resolution + 10] = 200
    const report = validateHeightmap({
      heightmap: data,
      resolution,
      worldSize,
      sampleAt: sampler(data),
      options: { expectedRangeMeters: 40 },
    })
    expect(report.pass).toBe(false)
    expect(report.reasons.some((r) => r.includes('neighbour delta'))).toBe(true)
  })

  test('fails when landmark expectation mis-matched', () => {
    const data = makeRamp(40)
    const report = validateHeightmap({
      heightmap: data,
      resolution,
      worldSize,
      sampleAt: sampler(data),
      options: {
        expectedRangeMeters: 40,
        landmarks: [
          { label: 'wrong', worldX: 0, worldZ: 0, expectedHeight: 100, toleranceM: 5 },
        ],
      },
    })
    expect(report.pass).toBe(false)
    expect(report.reasons.some((r) => r.includes('landmark'))).toBe(true)
  })
})
