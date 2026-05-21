import { describe, expect, test } from 'vitest'
import { buildRibbonBoundary, cleanInsideCornerSelfIntersections } from './ribbonBoundary'
import {
  buildEdgeLineFromBoundary,
  buildSideBandFromBoundary,
} from './ribbonGeometry'
import { segmentIntersect2D } from './segmentIntersect'
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

  test('left boundary at exact perpendicular distance halfWidth from centerline for straight input', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    const halfWidth = WIDTH / 2
    for (let i = 0; i < STRAIGHT.length; i++) {
      const p = STRAIGHT[i]!
      const left = b.left[i]!
      const dist = Math.hypot(left.x - p.x, left.z - p.z)
      expect(dist).toBeCloseTo(halfWidth, 9)
    }
  })
})

describe('buildRibbonBoundary — perpendicular offset contract (Phase 3+)', () => {
  test('left boundary is exactly halfWidth from centerline on a straight (no miter widening)', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    for (let i = 0; i < STRAIGHT.length; i++) {
      const p = STRAIGHT[i]!
      const dist = Math.hypot(b.left[i]!.x - p.x, b.left[i]!.z - p.z)
      expect(dist).toBeCloseTo(WIDTH / 2, 9)
    }
  })

  test('right boundary is exactly halfWidth from centerline on a straight', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    for (let i = 0; i < STRAIGHT.length; i++) {
      const p = STRAIGHT[i]!
      const dist = Math.hypot(b.right[i]!.x - p.x, b.right[i]!.z - p.z)
      expect(dist).toBeCloseTo(WIDTH / 2, 9)
    }
  })

  test('cleanupStats is present on every boundary', () => {
    const b = buildRibbonBoundary(STRAIGHT, false, 12)!
    expect(b.cleanupStats).toBeDefined()
    expect(typeof b.cleanupStats.collapsed).toBe('number')
  })

  test('closed 4-corner square with 12 m width: boundary output has no self-intersecting segments', () => {
    const b = buildRibbonBoundary(CLOSED_SQUARE, true, 12)!
    const n = b.left.length
    for (const arr of [b.left, b.right]) {
      for (let i = 0; i < n - 1; i++) {
        for (let j = i + 2; j < n - 1; j++) {
          const hit = segmentIntersect2D(
            { x: arr[i]!.x, z: arr[i]!.z },
            { x: arr[i + 1]!.x, z: arr[i + 1]!.z },
            { x: arr[j]!.x, z: arr[j]!.z },
            { x: arr[j + 1]!.x, z: arr[j + 1]!.z },
          )
          expect(hit).toBeNull()
        }
      }
    }
  })

  test('elevation-change straight: left boundary at exact halfWidth from centerline at every sample', () => {
    const WIDTH = 12
    const pts: TrackRibbonPoint[] = [
      { x: 0, y: 0, z: 0, isPitLane: false },
      { x: 10, y: 5, z: 0, isPitLane: false },
      { x: 20, y: 10, z: 0, isPitLane: false },
    ]
    const b = buildRibbonBoundary(pts, false, WIDTH)!
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      const dist = Math.hypot(b.left[i]!.x - p.x, b.left[i]!.z - p.z)
      expect(dist).toBeCloseTo(WIDTH / 2, 9)
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

describe('buildEdgeLineFromBoundary', () => {
  test('outer vertex equals boundary.left[i] for side=left', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    const result = buildEdgeLineFromBoundary(b, 'left', 0.2)!
    for (let i = 0; i < STRAIGHT.length; i++) {
      const outerBase = i * 2 * 3
      expect(Math.abs(result.positions[outerBase]! - b.left[i]!.x)).toBeLessThan(1e-9)
      expect(Math.abs(result.positions[outerBase + 2]! - b.left[i]!.z)).toBeLessThan(1e-9)
    }
  })

  test('outer vertex equals boundary.right[i] for side=right (outermost index is odd)', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    const result = buildEdgeLineFromBoundary(b, 'right', 0.2)!
    for (let i = 0; i < STRAIGHT.length; i++) {
      const outerBase = (i * 2 + 1) * 3
      expect(Math.abs(result.positions[outerBase]! - b.right[i]!.x)).toBeLessThan(1e-9)
      expect(Math.abs(result.positions[outerBase + 2]! - b.right[i]!.z)).toBeLessThan(1e-9)
    }
  })

  test('curve: outer edge vertex aligns with boundary.right[i] to 1e-9', () => {
    const CURVE: TrackRibbonPoint[] = []
    const R = 50
    const steps = 24
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 0.5
      CURVE.push({ x: Math.cos(a) * R, y: 0, z: Math.sin(a) * R, isPitLane: false })
    }
    const WIDTH = 12
    const LINE_WIDTH = 0.2
    const b = buildRibbonBoundary(CURVE, false, WIDTH)!
    const boundaryResult = buildEdgeLineFromBoundary(b, 'right', LINE_WIDTH)!

    for (let i = 0; i < CURVE.length; i++) {
      const edgeOuterBase = (i * 2 + 1) * 3
      expect(Math.abs(boundaryResult.positions[edgeOuterBase]! - b.right[i]!.x)).toBeLessThan(1e-5)
      expect(Math.abs(boundaryResult.positions[edgeOuterBase + 2]! - b.right[i]!.z)).toBeLessThan(1e-5)
    }
  })
})

describe('buildSideBandFromBoundary', () => {
  test('inner vertex equals boundary.right[i] when innerOffset=0 for side=right', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    const result = buildSideBandFromBoundary(b, 'right', 0, 3)!
    for (let i = 0; i < STRAIGHT.length; i++) {
      const innerBase = i * 2 * 3
      expect(Math.abs(result.positions[innerBase]! - b.right[i]!.x)).toBeLessThan(1e-9)
      expect(Math.abs(result.positions[innerBase + 2]! - b.right[i]!.z)).toBeLessThan(1e-9)
    }
  })

  test('inner vertex equals boundary.left[i] when innerOffset=0 for side=left', () => {
    const WIDTH = 12
    const b = buildRibbonBoundary(STRAIGHT, false, WIDTH)!
    const result = buildSideBandFromBoundary(b, 'left', 0, 3)!
    for (let i = 0; i < STRAIGHT.length; i++) {
      const innerBase = (i * 2 + 1) * 3
      expect(Math.abs(result.positions[innerBase]! - b.left[i]!.x)).toBeLessThan(1e-9)
      expect(Math.abs(result.positions[innerBase + 2]! - b.left[i]!.z)).toBeLessThan(1e-9)
    }
  })

  test('returns null when bandWidth <= 0', () => {
    const b = buildRibbonBoundary(STRAIGHT, false, 12)!
    expect(buildSideBandFromBoundary(b, 'left', 0, 0)).toBeNull()
    expect(buildSideBandFromBoundary(b, 'right', 0, -1)).toBeNull()
  })
})

import { Vector3 } from 'three'
import { computeRibbonTangents } from './ribbonMath'

function buildPerpendicularBoundary(
  pts: TrackRibbonPoint[],
  closed: boolean,
  halfWidth: number,
  side: 'left' | 'right',
): Vector3[] {
  const tangents = computeRibbonTangents(pts, closed)
  return pts.map((p, i) => {
    const tan = tangents[i]!
    const nx = -tan.z
    const nz = tan.x
    const sign = side === 'left' ? 1 : -1
    return new Vector3(p.x + sign * nx * halfWidth, p.y, p.z + sign * nz * halfWidth)
  })
}

function buildUTurnPoints(straight: number, turnRadius: number, arcSamples: number): TrackRibbonPoint[] {
  const pts: TrackRibbonPoint[] = []
  pts.push({ x: 0, y: 0, z: 0, isPitLane: false })
  pts.push({ x: straight, y: 0, z: 0, isPitLane: false })
  for (let i = 0; i <= arcSamples; i++) {
    const a = (i / arcSamples) * Math.PI
    pts.push({
      x: straight + Math.cos(a) * turnRadius,
      y: 0,
      z: Math.sin(a) * turnRadius,
      isPitLane: false,
    })
  }
  pts.push({ x: straight, y: 0, z: turnRadius * 2, isPitLane: false })
  pts.push({ x: 0, y: 0, z: turnRadius * 2, isPitLane: false })
  return pts
}

function countPolylineIntersections(arr: { x: number; z: number }[]): number {
  let count = 0
  const n = arr.length
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      const hit = segmentIntersect2D(
        { x: arr[i]!.x, z: arr[i]!.z },
        { x: arr[i + 1]!.x, z: arr[i + 1]!.z },
        { x: arr[j]!.x, z: arr[j]!.z },
        { x: arr[j + 1]!.x, z: arr[j + 1]!.z },
      )
      if (hit) count++
    }
  }
  return count
}

describe('cleanInsideCornerSelfIntersections', () => {
  test('straight 2-point input: stats.collapsed === 0, arrays untouched', () => {
    const b = buildRibbonBoundary(STRAIGHT, false, 12)!
    const leftCopy = b.left.map(v => v.clone())
    const rightCopy = b.right.map(v => v.clone())
    const { stats } = cleanInsideCornerSelfIntersections(b.left, b.right, false)
    expect(stats.collapsed).toBe(0)
    for (let i = 0; i < STRAIGHT.length; i++) {
      expect(b.left[i]!.x).toBeCloseTo(leftCopy[i]!.x, 9)
      expect(b.left[i]!.z).toBeCloseTo(leftCopy[i]!.z, 9)
      expect(b.right[i]!.x).toBeCloseTo(rightCopy[i]!.x, 9)
      expect(b.right[i]!.z).toBeCloseTo(rightCopy[i]!.z, 9)
    }
  })

  test('U-turn with 10 m radius and 12 m width: cleanup produces zero self-intersections after pass', () => {
    const pts = buildUTurnPoints(20, 10, 16)
    const inside = buildPerpendicularBoundary(pts, false, 6, 'right')
    const outside = buildPerpendicularBoundary(pts, false, 6, 'left')
    const { left, right } = cleanInsideCornerSelfIntersections(outside, inside, false)
    expect(countPolylineIntersections(left)).toBe(0)
    expect(countPolylineIntersections(right)).toBe(0)
  })

  test('U-turn with 2 m radius, 12 m width: cleanup collapses intersections and produces clean output', () => {
    const pts = buildUTurnPoints(20, 2, 16)
    const inside = buildPerpendicularBoundary(pts, false, 6, 'right')
    const outside = buildPerpendicularBoundary(pts, false, 6, 'left')
    const beforeCount = countPolylineIntersections(inside) + countPolylineIntersections(outside)
    expect(beforeCount).toBeGreaterThan(0)
    const { left, right, stats } = cleanInsideCornerSelfIntersections(outside, inside, false)
    expect(stats.collapsed).toBeGreaterThan(0)
    expect(countPolylineIntersections(left)).toBe(0)
    expect(countPolylineIntersections(right)).toBe(0)
  })

  test('output arrays preserve original length', () => {
    const pts = buildUTurnPoints(20, 2, 16)
    const inside = buildPerpendicularBoundary(pts, false, 6, 'right')
    const outside = buildPerpendicularBoundary(pts, false, 6, 'left')
    const origLen = inside.length
    const { left, right } = cleanInsideCornerSelfIntersections(outside, inside, false)
    expect(left.length).toBe(origLen)
    expect(right.length).toBe(origLen)
  })

  test('closed 4-corner square 12 m width: cleanup produces zero self-intersections', () => {
    const b = buildRibbonBoundary(CLOSED_SQUARE, true, 12)!
    const { left, right } = cleanInsideCornerSelfIntersections(b.left, b.right, true)
    expect(countPolylineIntersections(left)).toBe(0)
    expect(countPolylineIntersections(right)).toBe(0)
  })

  test('closed loop seam-straddling bowtie is collapsed (regression for codex finding)', () => {
    const turnRadius = 2
    const turnSamples = 16
    const pts: TrackRibbonPoint[] = []
    for (let i = 0; i <= turnSamples; i++) {
      const a = -Math.PI / 2 + (i / turnSamples) * Math.PI
      pts.push({
        x: Math.cos(a) * turnRadius,
        y: 0,
        z: Math.sin(a) * turnRadius,
        isPitLane: false,
      })
    }
    pts.push({ x: 0, y: 0, z: 10, isPitLane: false })
    pts.push({ x: -10, y: 0, z: 10, isPitLane: false })
    pts.push({ x: -10, y: 0, z: 0, isPitLane: false })
    const b = buildRibbonBoundary(pts, true, 12)!
    for (const arr of [b.left, b.right]) {
      const n = arr.length
      for (let i = 0; i < n; i++) {
        const iNext = (i + 1) % n
        for (let step = 2; step < n - 1; step++) {
          const j = (i + step) % n
          const jNext = (i + step + 1) % n
          if (j === i || jNext === i || jNext === iNext) continue
          const hit = segmentIntersect2D(
            { x: arr[i]!.x, z: arr[i]!.z },
            { x: arr[iNext]!.x, z: arr[iNext]!.z },
            { x: arr[j]!.x, z: arr[j]!.z },
            { x: arr[jNext]!.x, z: arr[jNext]!.z },
          )
          expect(hit).toBeNull()
        }
      }
    }
  })

  test('wide-offset U-turn (width=30): cleanup window scales with halfWidth (regression for codex finding)', () => {
    const pts = buildUTurnPoints(20, 5, 64)
    const b = buildRibbonBoundary(pts, false, 30)!
    expect(countPolylineIntersections(b.left)).toBe(0)
    expect(countPolylineIntersections(b.right)).toBe(0)
  })

  test('elevated U-turn: collapsed vertices interpolate y (no vertical stack at fan)', () => {
    const pts = buildUTurnPoints(20, 2, 16)
    for (let i = 0; i < pts.length; i++) {
      pts[i]!.y = i * 0.5
    }
    const b = buildRibbonBoundary(pts, false, 12)!
    const xzGroups = new Map<string, number[]>()
    for (const arr of [b.left, b.right]) {
      for (const v of arr) {
        const key = `${v.x.toFixed(4)}|${v.z.toFixed(4)}`
        const ys = xzGroups.get(key) ?? []
        ys.push(v.y)
        xzGroups.set(key, ys)
      }
    }
    for (const ys of xzGroups.values()) {
      if (ys.length < 2) continue
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      expect(maxY - minY).toBeLessThan(1e-6)
    }
  })
})
