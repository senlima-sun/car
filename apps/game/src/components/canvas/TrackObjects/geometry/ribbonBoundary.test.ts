import { describe, expect, test } from 'bun:test'
import { buildRibbonBoundary } from './ribbonBoundary'
import {
  buildEdgeLineFromBoundary,
  buildParentSideBandGeometry,
  buildSideBandFromBoundary,
  computeRibbonFrames,
} from './ribbonGeometry'
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

describe('buildRibbonBoundary — byte-identical equivalence with legacy computeRibbonFrames', () => {
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
  ]

  for (const [label, pts, closed] of syntheticInputs) {
    test(`${label}: left/right match computeRibbonFrames element-wise to 1e-9`, () => {
      const WIDTH = 12
      const b = buildRibbonBoundary(pts, closed, WIDTH)!
      const frames = computeRibbonFrames(pts, closed, WIDTH)!
      for (let i = 0; i < pts.length; i++) {
        expect(Math.abs(b.left[i]!.x - frames.leftPositions[i]!.x)).toBeLessThan(1e-9)
        expect(Math.abs(b.left[i]!.y - frames.leftPositions[i]!.y)).toBeLessThan(1e-9)
        expect(Math.abs(b.left[i]!.z - frames.leftPositions[i]!.z)).toBeLessThan(1e-9)
        expect(Math.abs(b.right[i]!.x - frames.rightPositions[i]!.x)).toBeLessThan(1e-9)
        expect(Math.abs(b.right[i]!.y - frames.rightPositions[i]!.y)).toBeLessThan(1e-9)
        expect(Math.abs(b.right[i]!.z - frames.rightPositions[i]!.z)).toBeLessThan(1e-9)
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
