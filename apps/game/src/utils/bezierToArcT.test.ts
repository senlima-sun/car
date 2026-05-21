import { describe, expect, test } from 'vitest'
import { bezierTToArcT } from './bezierToArcT'
import type { Anchor, Path } from '@/components/ui/TrackEditor/geometry/types'

function anchor(id: string, x: number, y: number): Anchor {
  return {
    id,
    point: { x, y },
    inHandle: { x, y },
    outHandle: { x, y },
    handleType: 'corner',
  }
}

function makeStraightPath(...points: Array<[number, number]>): Path {
  return {
    id: 'p1',
    anchors: points.map(([x, y], i) => anchor(`a${i}`, x, y)),
    closed: false,
    stroke: '#fff',
    strokeWidth: 1,
    fill: 'none',
  }
}

describe('bezierTToArcT', () => {
  test('midpoint of a 3-segment equal-length straight path maps to ~0.5 arc-T', () => {
    const path = makeStraightPath([0, 0], [100, 0], [200, 0], [300, 0])
    const arcT = bezierTToArcT(path, 1.5, [path])
    expect(arcT).toBeCloseTo(0.5, 2)
  })

  test('bezierT=0 maps to arc-T 0', () => {
    const path = makeStraightPath([0, 0], [100, 0], [200, 0])
    expect(bezierTToArcT(path, 0, [path])).toBeCloseTo(0, 4)
  })

  test('bezierT at end maps to arc-T 1', () => {
    const path = makeStraightPath([0, 0], [100, 0], [200, 0])
    expect(bezierTToArcT(path, 2, [path])).toBeCloseTo(1, 2)
  })

  test('arcT is monotonically non-decreasing in bezierT', () => {
    const path = makeStraightPath([0, 0], [80, 60], [200, 30], [300, 100])
    let prev = 0
    for (const t of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
      const arcT = bezierTToArcT(path, t, [path])
      expect(arcT).toBeGreaterThanOrEqual(prev - 1e-6)
      prev = arcT
    }
  })
})
