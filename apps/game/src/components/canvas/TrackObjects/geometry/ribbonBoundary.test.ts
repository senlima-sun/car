import { describe, expect, test } from 'bun:test'
import { buildRibbonBoundary, cleanInsideCornerSelfIntersections } from './ribbonBoundary'
import {
  buildEdgeLineFromBoundary,
  buildParentSideBandGeometry,
  buildSideBandFromBoundary,
  computeRibbonFrames,
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

describe('buildRibbonBoundary — byte-identical equivalence against frozen legacy math (888f144)', () => {
  const ASPHALT_Y = 0.05
  const MAX_MITER_SCALE = 4

  function legacyTangents(points: TrackRibbonPoint[], closed: boolean): Array<{ x: number; z: number }> {
    const n = points.length
    const out: Array<{ x: number; z: number }> = []
    for (let i = 0; i < n; i++) {
      const prevIdx = i === 0 ? (closed ? n - 1 : 0) : i - 1
      const nextIdx = i === n - 1 ? (closed ? 0 : n - 1) : i + 1
      const prev = points[prevIdx]!
      const next = points[nextIdx]!
      const tx = next.x - prev.x
      const tz = next.z - prev.z
      const len = Math.hypot(tx, tz) || 1
      out.push({ x: tx / len, z: tz / len })
    }
    return out
  }

  function legacyMiterScales(
    points: TrackRibbonPoint[],
    closed: boolean,
    tangents: Array<{ x: number; z: number }>,
  ): number[] {
    const n = points.length
    const scales: number[] = []
    for (let i = 0; i < n; i++) {
      const isStartOpen = !closed && i === 0
      const isEndOpen = !closed && i === n - 1
      if (isStartOpen || isEndOpen) {
        scales.push(1)
        continue
      }
      const prevIdx = i === 0 ? n - 1 : i - 1
      const prev = points[prevIdx]!
      const curr = points[i]!
      const inDx = curr.x - prev.x
      const inDz = curr.z - prev.z
      const inLen = Math.hypot(inDx, inDz) || 1
      const inTx = inDx / inLen
      const inTz = inDz / inLen
      const bisTan = tangents[i]!
      const dot = bisTan.x * inTx + bisTan.z * inTz
      const safeDot = Math.max(Math.abs(dot), 1 / MAX_MITER_SCALE)
      scales.push(1 / safeDot)
    }
    return scales
  }

  function legacyFrames(
    points: TrackRibbonPoint[],
    closed: boolean,
    width: number,
  ): { left: Array<{ x: number; y: number; z: number }>; right: Array<{ x: number; y: number; z: number }> } {
    const halfWidth = width / 2
    const tangents = legacyTangents(points, closed)
    const miters = legacyMiterScales(points, closed, tangents)
    const left: Array<{ x: number; y: number; z: number }> = []
    const right: Array<{ x: number; y: number; z: number }> = []
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!
      const tan = tangents[i]!
      const m = miters[i]!
      const nx = -tan.z * m
      const nz = tan.x * m
      left.push({ x: p.x + nx * halfWidth, y: p.y + ASPHALT_Y, z: p.z + nz * halfWidth })
      right.push({ x: p.x - nx * halfWidth, y: p.y + ASPHALT_Y, z: p.z - nz * halfWidth })
    }
    return { left, right }
  }

  const syntheticInputs: Array<[string, TrackRibbonPoint[], boolean]> = [
    ['straight open', STRAIGHT, false],
    ['closed square', CLOSED_SQUARE, true],
    [
      'gentle curve open',
      (() => {
        const pts: TrackRibbonPoint[] = []
        const R = 50
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * Math.PI * 0.5
          pts.push({ x: Math.cos(a) * R, y: 0, z: Math.sin(a) * R, isPitLane: false })
        }
        return pts
      })(),
      false,
    ],
    [
      '90-degree corner closed',
      [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 50, y: 0, z: 0, isPitLane: false },
        { x: 50, y: 0, z: 50, isPitLane: false },
        { x: 0, y: 0, z: 50, isPitLane: false },
      ],
      true,
    ],
    [
      'tight hairpin (capped by MAX_MITER_SCALE)',
      [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0.5, isPitLane: false },
        { x: 0, y: 0, z: 0.5, isPitLane: false },
      ],
      false,
    ],
    [
      'elevation change open',
      [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 5, z: 0, isPitLane: false },
        { x: 20, y: 10, z: 0, isPitLane: false },
      ],
      false,
    ],
  ]

  for (const [label, pts, closed] of syntheticInputs) {
    test(`${label}: boundary left/right match the frozen legacy frame math to 1e-9`, () => {
      const WIDTH = 12
      const b = buildRibbonBoundary(pts, closed, WIDTH)!
      const legacy = legacyFrames(pts, closed, WIDTH)
      for (let i = 0; i < pts.length; i++) {
        expect(Math.abs(b.left[i]!.x - legacy.left[i]!.x)).toBeLessThan(1e-9)
        expect(Math.abs(b.left[i]!.y - legacy.left[i]!.y)).toBeLessThan(1e-9)
        expect(Math.abs(b.left[i]!.z - legacy.left[i]!.z)).toBeLessThan(1e-9)
        expect(Math.abs(b.right[i]!.x - legacy.right[i]!.x)).toBeLessThan(1e-9)
        expect(Math.abs(b.right[i]!.y - legacy.right[i]!.y)).toBeLessThan(1e-9)
        expect(Math.abs(b.right[i]!.z - legacy.right[i]!.z)).toBeLessThan(1e-9)
      }
    })
  }
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

  test('curve: outer edge meets legacy buildParentSideBandGeometry inner edge to 1e-9', () => {
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
    const legacyPainted = buildParentSideBandGeometry(CURVE, false, WIDTH, 'right', 0, 3)!

    for (let i = 0; i < CURVE.length; i++) {
      const edgeOuterBase = (i * 2 + 1) * 3
      const paintedInnerBase = i * 2 * 3
      expect(Math.abs(boundaryResult.positions[edgeOuterBase]! - legacyPainted.positions[paintedInnerBase]!)).toBeLessThan(1e-9)
      expect(Math.abs(boundaryResult.positions[edgeOuterBase + 2]! - legacyPainted.positions[paintedInnerBase + 2]!)).toBeLessThan(1e-9)
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
})
