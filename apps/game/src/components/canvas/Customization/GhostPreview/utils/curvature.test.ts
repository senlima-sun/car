import { describe, expect, it } from 'vitest'
import { computeCurvatureRadius } from './curvature'

describe('computeCurvatureRadius', () => {
  it('returns Infinity for collinear points', () => {
    const result = computeCurvatureRadius([0, 0, 0], [5, 0, 0], [10, 0, 0])
    expect(result.radius).toBe(Infinity)
  })

  it('returns Infinity for collinear points along z-axis', () => {
    const result = computeCurvatureRadius([0, 0, 0], [0, 0, 5], [0, 0, 10])
    expect(result.radius).toBe(Infinity)
  })

  it('returns finite radius for symmetric arc with control point on +z side', () => {
    const result = computeCurvatureRadius([-1, 0, 0], [0, 0, 1], [1, 0, 0])
    expect(Number.isFinite(result.radius)).toBe(true)
    expect(result.radius).toBeGreaterThan(0)
  })

  it('mirrored control point produces same radius but opposite-side center', () => {
    const a = computeCurvatureRadius([-1, 0, 0], [0, 0, 1], [1, 0, 0])
    const b = computeCurvatureRadius([-1, 0, 0], [0, 0, -1], [1, 0, 0])
    expect(b.radius).toBeCloseTo(a.radius, 6)
    expect(Math.sign(a.center[2])).not.toBe(Math.sign(b.center[2]))
  })

  it('center lies in y=0 plane', () => {
    const { center } = computeCurvatureRadius([-2, 0, 0], [0, 0, 3], [2, 0, 0])
    expect(center[1]).toBe(0)
  })

  it('unit Bezier arc produces radius 1.0 at t=0.5', () => {
    const { radius } = computeCurvatureRadius([-1, 0, 0], [0, 0, 1], [1, 0, 0])
    expect(radius).toBeCloseTo(1.0, 6)
  })
})
