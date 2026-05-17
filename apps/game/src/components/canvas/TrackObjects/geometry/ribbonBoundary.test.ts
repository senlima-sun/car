import { describe, expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { buildRibbonBoundary } from './ribbonBoundary'
import { computeRibbonFrames } from './ribbonGeometry'
import type { TrackRibbonPoint } from '@/types/trackObjects'

const STRAIGHT: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 0, isPitLane: false },
]

const CLOSED_SQUARE: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 10, isPitLane: false },
  { x: 0, y: 0, z: 10, isPitLane: false },
]

describe('buildRibbonBoundary — null inputs', () => {
  test('returns null for fewer than 2 points', () => {
    expect(buildRibbonBoundary([{ x: 0, y: 0, z: 0, isPitLane: false }], false, 12)).toBeNull()
  })

  test('returns null for empty array', () => {
    expect(buildRibbonBoundary([], false, 12)).toBeNull()
  })

  test('returns null for width = 0', () => {
    expect(buildRibbonBoundary(STRAIGHT, false, 0)).toBeNull()
  })

  test('returns null for negative width', () => {
    expect(buildRibbonBoundary(STRAIGHT, false, -1)).toBeNull()
  })

  test('returns null for width = NaN', () => {
    expect(buildRibbonBoundary(STRAIGHT, false, NaN)).toBeNull()
  })

  test('returns null for width = Infinity', () => {
    expect(buildRibbonBoundary(STRAIGHT, false, Infinity)).toBeNull()
  })
})

describe('buildRibbonBoundary — straight', () => {
  test('left[i] - centerline[i] is perpendicular to tangent, magnitude = halfWidth', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    const halfWidth = WIDTH / 2
    for (let i = 0; i < STRAIGHT.length; i++) {
      const p = STRAIGHT[i]!
      const left = b.left[i]!
      const dx = left.x - p.x
      const dz = left.z - p.z
      expect(Math.hypot(dx, dz)).toBeCloseTo(halfWidth, 9)
    }
  })

  test('boundaries match legacy computeRibbonFrames output', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    const frames = computeRibbonFrames(STRAIGHT, false, WIDTH)!
    for (let i = 0; i < STRAIGHT.length; i++) {
      expect(b.left[i]!.x).toBeCloseTo(frames.leftPositions[i]!.x, 9)
      expect(b.left[i]!.y).toBeCloseTo(frames.leftPositions[i]!.y, 9)
      expect(b.left[i]!.z).toBeCloseTo(frames.leftPositions[i]!.z, 9)
      expect(b.right[i]!.x).toBeCloseTo(frames.rightPositions[i]!.x, 9)
      expect(b.right[i]!.y).toBeCloseTo(frames.rightPositions[i]!.y, 9)
      expect(b.right[i]!.z).toBeCloseTo(frames.rightPositions[i]!.z, 9)
    }
  })
})

describe('buildRibbonBoundary — closed 4-corner square', () => {
  test('corner boundaries match legacy miter output', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(CLOSED_SQUARE, true, WIDTH)!
    const frames = computeRibbonFrames(CLOSED_SQUARE, true, WIDTH)!
    for (let i = 0; i < CLOSED_SQUARE.length; i++) {
      expect(b.left[i]!.x).toBeCloseTo(frames.leftPositions[i]!.x, 9)
      expect(b.left[i]!.y).toBeCloseTo(frames.leftPositions[i]!.y, 9)
      expect(b.left[i]!.z).toBeCloseTo(frames.leftPositions[i]!.z, 9)
      expect(b.right[i]!.x).toBeCloseTo(frames.rightPositions[i]!.x, 9)
      expect(b.right[i]!.y).toBeCloseTo(frames.rightPositions[i]!.y, 9)
      expect(b.right[i]!.z).toBeCloseTo(frames.rightPositions[i]!.z, 9)
    }
  })
})

describe('buildRibbonBoundary — arcLength', () => {
  test('is monotonically non-decreasing', () => {
    const b = buildRibbonBoundary(CLOSED_SQUARE, true, 12)!
    for (let i = 1; i < b.arcLength.length; i++) {
      expect(b.arcLength[i]!).toBeGreaterThanOrEqual(b.arcLength[i - 1]!)
    }
  })

  test('arcLength[0] = 0', () => {
    const b = buildRibbonBoundary(STRAIGHT, false, 12)!
    expect(b.arcLength[0]).toBe(0)
  })

  test('arcLength is correct for straight', () => {
    const b = buildRibbonBoundary(STRAIGHT, false, 12)!
    expect(b.arcLength[1]).toBeCloseTo(10, 9)
  })

  test('closed input adds closing-segment to totalArcLength', () => {
    const b = buildRibbonBoundary(CLOSED_SQUARE, true, 12)!
    const n = CLOSED_SQUARE.length
    const openTotal = b.arcLength[n - 1]!
    expect(b.totalArcLength).toBeGreaterThan(openTotal)
    expect(b.totalArcLength).toBeCloseTo(40, 9)
  })

  test('open input totalArcLength equals last arcLength entry', () => {
    const b = buildRibbonBoundary(STRAIGHT, false, 12)!
    expect(b.totalArcLength).toBeCloseTo(b.arcLength[b.arcLength.length - 1]!, 9)
  })
})
