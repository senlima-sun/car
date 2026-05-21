import { describe, expect, test } from 'vitest'
import { segmentIntersect2D } from './segmentIntersect'

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

describe('segmentIntersect2D', () => {
  test('parallel non-overlapping segments return null', () => {
    const result = segmentIntersect2D(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    )
    expect(result).toBeNull()
  })

  test('collinear overlapping segments return null (no proper intersection)', () => {
    const result = segmentIntersect2D(
      { x: 0, z: 0 },
      { x: 2, z: 0 },
      { x: 1, z: 0 },
      { x: 3, z: 0 },
    )
    expect(result).toBeNull()
  })

  test('collinear non-overlapping segments return null', () => {
    const result = segmentIntersect2D(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 3, z: 0 },
    )
    expect(result).toBeNull()
  })

  test('T-junction (shared endpoint) returns null — proper-crossing only', () => {
    const result = segmentIntersect2D(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    )
    expect(result).toBeNull()
  })

  test('proper-crossing returns correct t, u, and point', () => {
    const a0 = { x: 0, z: 0 }
    const a1 = { x: 2, z: 0 }
    const b0 = { x: 1, z: -1 }
    const b1 = { x: 1, z: 1 }
    const result = segmentIntersect2D(a0, a1, b0, b1)
    expect(result).not.toBeNull()
    expect(result!.t).toBeCloseTo(0.5, 9)
    expect(result!.u).toBeCloseTo(0.5, 9)
    expect(Math.abs(result!.point.x - lerp(a0.x, a1.x, result!.t))).toBeLessThan(1e-9)
    expect(Math.abs(result!.point.z - lerp(a0.z, a1.z, result!.t))).toBeLessThan(1e-9)
    expect(Math.abs(result!.point.x - lerp(b0.x, b1.x, result!.u))).toBeLessThan(1e-9)
    expect(Math.abs(result!.point.z - lerp(b0.z, b1.z, result!.u))).toBeLessThan(1e-9)
  })

  test('diagonal proper-crossing returns t and u in (0, 1)', () => {
    const a0 = { x: 0, z: 0 }
    const a1 = { x: 4, z: 4 }
    const b0 = { x: 0, z: 4 }
    const b1 = { x: 4, z: 0 }
    const result = segmentIntersect2D(a0, a1, b0, b1)
    expect(result).not.toBeNull()
    expect(result!.t).toBeGreaterThan(0)
    expect(result!.t).toBeLessThan(1)
    expect(result!.u).toBeGreaterThan(0)
    expect(result!.u).toBeLessThan(1)
    expect(result!.point.x).toBeCloseTo(2, 9)
    expect(result!.point.z).toBeCloseTo(2, 9)
  })

  test('near-miss (segments do not touch) returns null', () => {
    const result = segmentIntersect2D(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: -1 },
      { x: 2, z: 1 },
    )
    expect(result).toBeNull()
  })

  test('segments that extend toward each other but stop short return null', () => {
    const result = segmentIntersect2D(
      { x: 0, z: 0 },
      { x: 0.4, z: 0 },
      { x: 0.6, z: -1 },
      { x: 0.6, z: 1 },
    )
    expect(result).toBeNull()
  })

  test('asymmetric crossing: point matches both lerp formulas', () => {
    const a0 = { x: 0, z: 1 }
    const a1 = { x: 6, z: 1 }
    const b0 = { x: 2, z: 0 }
    const b1 = { x: 2, z: 4 }
    const result = segmentIntersect2D(a0, a1, b0, b1)
    expect(result).not.toBeNull()
    const pFromA = { x: lerp(a0.x, a1.x, result!.t), z: lerp(a0.z, a1.z, result!.t) }
    const pFromB = { x: lerp(b0.x, b1.x, result!.u), z: lerp(b0.z, b1.z, result!.u) }
    expect(Math.abs(pFromA.x - pFromB.x)).toBeLessThan(1e-9)
    expect(Math.abs(pFromA.z - pFromB.z)).toBeLessThan(1e-9)
    expect(Math.abs(result!.point.x - pFromA.x)).toBeLessThan(1e-9)
    expect(Math.abs(result!.point.z - pFromA.z)).toBeLessThan(1e-9)
  })
})
