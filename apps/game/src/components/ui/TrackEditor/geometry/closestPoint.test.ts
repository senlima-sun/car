import { describe, expect, test } from 'vitest'
import {
  closestPointOnPath,
  closestPointOnAnyPath,
  pointOnPath,
  sampleSegment,
  segmentCount,
  segmentTangent,
} from './closestPoint'
import { makeAnchor, makePath } from './path'

describe('closestPointOnPath', () => {
  test('returns null when path has fewer than 2 anchors', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    expect(closestPointOnPath(p, { x: 5, y: 5 })).toBeNull()
  })

  test('straight line: finds midpoint when query is perpendicular at middle', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const r = closestPointOnPath(p, { x: 50, y: 20 })!
    expect(r.segmentIndex).toBe(0)
    expect(r.t).toBeCloseTo(0.5, 2)
    expect(r.point.x).toBeCloseTo(50, 1)
    expect(r.point.y).toBeCloseTo(0, 1)
    expect(r.distance).toBeCloseTo(20, 1)
  })

  test('straight line: tangent is along segment direction', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const r = closestPointOnPath(p, { x: 50, y: 20 })!
    expect(r.tangent.x).toBeCloseTo(1, 3)
    expect(r.tangent.y).toBeCloseTo(0, 3)
  })

  test('picks correct segment among three-anchor path', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 200, y: 0 }))

    const near2 = closestPointOnPath(p, { x: 150, y: 10 })!
    expect(near2.segmentIndex).toBe(1)
    expect(near2.t).toBeCloseTo(0.5, 2)

    const near1 = closestPointOnPath(p, { x: 50, y: 10 })!
    expect(near1.segmentIndex).toBe(0)
  })

  test('query near start/end returns t at boundary', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const start = closestPointOnPath(p, { x: -10, y: 0 })!
    expect(start.t).toBeCloseTo(0, 2)

    const end = closestPointOnPath(p, { x: 110, y: 0 })!
    expect(end.t).toBeCloseTo(1, 2)
  })

  test('curved segment: closest point lies on the curve', () => {
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 0, y: 100 }
    a0.handleType = 'mirror'
    const a1 = makeAnchor({ x: 100, y: 100 })
    a1.inHandle = { x: 0, y: 100 }
    a1.handleType = 'mirror'

    const p = makePath(a0)
    p.anchors.push(a1)

    const r = closestPointOnPath(p, { x: 50, y: 200 })!
    expect(r.segmentIndex).toBe(0)
    const sampled = sampleSegment(
      p.anchors[0]! as Parameters<typeof sampleSegment>[0],
      p.anchors[1]! as Parameters<typeof sampleSegment>[1],
      r.t,
    )
    expect(r.point.x).toBeCloseTo(sampled.x, 3)
    expect(r.point.y).toBeCloseTo(sampled.y, 3)
  })

  test('closed path includes the closing segment', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))
    p.closed = true

    expect(segmentCount(p)).toBe(3)

    const r = closestPointOnPath(p, { x: 50, y: 50 })!
    expect(r.segmentIndex).toBe(2)
    expect(r.t).toBeCloseTo(0.5, 1)
  })

  test('closestPointOnAnyPath picks path with minimal distance', () => {
    const p1 = makePath(makeAnchor({ x: 0, y: 0 }))
    p1.anchors.push(makeAnchor({ x: 10, y: 0 }))
    const p2 = makePath(makeAnchor({ x: 1000, y: 1000 }))
    p2.anchors.push(makeAnchor({ x: 1010, y: 1000 }))

    const r = closestPointOnAnyPath([p1, p2], { x: 5, y: 1 })!
    expect(r.pathId).toBe(p1.id)
  })

  test('pointOnPath returns null for invalid segment index', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 10, y: 0 }))
    expect(pointOnPath(p, 5, 0.5)).toBeNull()
  })

  test('segmentTangent normalized to unit length', () => {
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 0, y: 100 }
    const a1 = makeAnchor({ x: 100, y: 100 })
    a1.inHandle = { x: 0, y: 100 }
    const p = makePath(a0)
    p.anchors.push(a1)

    const tan = segmentTangent(
      p.anchors[0]! as Parameters<typeof segmentTangent>[0],
      p.anchors[1]! as Parameters<typeof segmentTangent>[1],
      0.5,
    )
    const len = Math.hypot(tan.x, tan.y)
    expect(len).toBeCloseTo(1, 3)
  })
})
