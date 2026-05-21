import { describe, expect, test } from 'vitest'
import { pathToRoads, documentToRoads } from './pathToRoads'
import { makeAnchor, makePath } from '../geometry/path'
import { TRACK_WIDTH } from '@/constants/dimensions'

type Vec3 = [number, number, number]

function cubicPoint(p0: Vec3, c1: Vec3, c2: Vec3, p3: Vec3, t: number): Vec3 {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
    u * u * u * p0[2] + 3 * u * u * t * c1[2] + 3 * u * t * t * c2[2] + t * t * t * p3[2],
  ]
}

function quadraticPoint(p0: Vec3, q: Vec3, p2: Vec3, t: number): Vec3 {
  const u = 1 - t
  return [
    u * u * p0[0] + 2 * u * t * q[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * q[1] + t * t * p2[1],
    u * u * p0[2] + 2 * u * t * q[2] + t * t * p2[2],
  ]
}

function dist3(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

function maxApproxError(
  roads: ReturnType<typeof pathToRoads>,
  p0: Vec3,
  c1: Vec3,
  c2: Vec3,
  p3: Vec3,
): number {
  let maxErr = 0
  const SAMPLES = 200
  for (let i = 0; i <= SAMPLES; i++) {
    const tGlobal = i / SAMPLES
    const cubicPt = cubicPoint(p0, c1, c2, p3, tGlobal)

    let minDistToRoads = Infinity
    for (const road of roads) {
      if (road.trackMode !== 'curve' || !road.controlPoint) continue
      const rp0 = road.startPoint as Vec3
      const rp2 = road.endPoint as Vec3
      const rq = road.controlPoint as Vec3
      for (let j = 0; j <= 50; j++) {
        const tLocal = j / 50
        const qPt = quadraticPoint(rp0, rq, rp2, tLocal)
        const d = dist3(cubicPt, qPt)
        if (d < minDistToRoads) minDistToRoads = d
      }
    }

    if (minDistToRoads < Infinity && minDistToRoads > maxErr) maxErr = minDistToRoads
  }
  return maxErr
}

describe('pathToRoads', () => {
  test('returns empty for paths with fewer than 2 anchors', () => {
    const a = makeAnchor({ x: 0, y: 0 })
    const path = makePath(a)
    expect(pathToRoads(path)).toEqual([])
  })

  test('two corner anchors become one straight road', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const roads = pathToRoads(p)
    expect(roads).toHaveLength(1)
    const r = roads[0]!
    expect(r.type).toBe('road')
    expect(r.trackMode).toBe('straight')
    expect(r.width).toBe(TRACK_WIDTH)
    expect(r.startPoint).toEqual([0, 0, 0])
    expect(r.endPoint).toEqual([100, 0, 0])
    expect(r.controlPoint).toBeUndefined()
  })

  test('maps editor XY to world XZ with y=0', () => {
    const p = makePath(makeAnchor({ x: 10, y: 20 }))
    p.anchors.push(makeAnchor({ x: 30, y: 40 }))

    const r = pathToRoads(p)[0]!
    expect(r.startPoint).toEqual([10, 0, 20])
    expect(r.endPoint).toEqual([30, 0, 40])
    expect(r.position).toEqual([20, 0, 30])
  })

  test('anchor with out-handle yields curved road segments with control points', () => {
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 50, y: 100 }
    a0.handleType = 'mirror'
    const a1 = makeAnchor({ x: 100, y: 0 })

    const p = makePath(a0)
    p.anchors.push(a1)

    const roads = pathToRoads(p)
    expect(roads.length).toBeGreaterThanOrEqual(1)
    for (const r of roads) {
      expect(r.trackMode).toBe('curve')
      expect(r.controlPoint).toBeDefined()
    }
  })

  test('closed path emits a closing segment group', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))
    p.closed = true

    const roads = pathToRoads(p)
    expect(roads.length).toBeGreaterThanOrEqual(3)

    const firstSegmentEnd = roads.find(r => r.startPoint![0] === 0 && r.startPoint![2] === 0)
    expect(firstSegmentEnd).toBeDefined()

    const closingSegs = roads.filter(r => r.endPoint![0] === 0 && r.endPoint![2] === 0)
    expect(closingSegs.length).toBeGreaterThanOrEqual(1)
  })

  test('three anchors (no handles) produce exactly two straight segments', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 50, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 50 }))

    const roads = pathToRoads(p)
    expect(roads).toHaveLength(2)
    expect(roads[0]!.startPoint).toEqual([0, 0, 0])
    expect(roads[0]!.endPoint).toEqual([50, 0, 0])
    expect(roads[1]!.startPoint).toEqual([50, 0, 0])
    expect(roads[1]!.endPoint).toEqual([100, 0, 50])
  })

  test('documentToRoads flattens multiple paths', () => {
    const p1 = makePath(makeAnchor({ x: 0, y: 0 }))
    p1.anchors.push(makeAnchor({ x: 10, y: 0 }))
    const p2 = makePath(makeAnchor({ x: 100, y: 100 }))
    p2.anchors.push(makeAnchor({ x: 200, y: 100 }))

    const roads = documentToRoads([p1, p2])
    expect(roads.length).toBeGreaterThanOrEqual(2)
    const firstRoad = roads.find(r => r.startPoint![0] === 0 && r.startPoint![2] === 0)
    expect(firstRoad).toBeDefined()
    const secondRoad = roads.find(r => r.startPoint![0] === 100 && r.startPoint![2] === 100)
    expect(secondRoad).toBeDefined()
  })

  test('marked pit lane segment becomes pitroad trackMode', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 200, y: 0 }))
    p.pitLaneSegments = [0]

    const roads = pathToRoads(p)
    expect(roads).toHaveLength(2)
    expect(roads[0]!.trackMode).toBe('pitroad')
    expect(roads[1]!.trackMode).toBe('straight')
  })

  test('curved pit lane segment becomes pitroad-curve', () => {
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 20, y: 40 }
    a0.handleType = 'mirror'
    const a1 = makeAnchor({ x: 100, y: 100 })
    a1.inHandle = { x: 80, y: 100 }
    a1.handleType = 'mirror'
    const p = makePath(a0)
    p.anchors.push(a1)
    p.pitLaneSegments = [0]

    const roads = pathToRoads(p)
    expect(roads.length).toBeGreaterThan(0)
    for (const r of roads) {
      expect(r.trackMode).toBe('pitroad-curve')
    }
  })

  test('every emitted road has unique id', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 10, y: 0 }))
    p.anchors.push(makeAnchor({ x: 20, y: 0 }))
    p.anchors.push(makeAnchor({ x: 30, y: 0 }))

    const ids = pathToRoads(p).map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('90-degree arc (~100m radius) stays within 0.25m tolerance after subdivision', () => {
    const k = (4 / 3) * Math.tan(Math.PI / 8)
    const R = 100
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 0, y: k * R }
    const a1 = makeAnchor({ x: R, y: R })
    a1.inHandle = { x: R - k * R, y: R }

    const p = makePath(a0)
    p.anchors.push(a1)

    const roads = pathToRoads(p)
    expect(roads.length).toBeGreaterThan(1)

    const p0: Vec3 = [0, 0, 0]
    const c1: Vec3 = [0, 0, k * R]
    const c2: Vec3 = [R - k * R, 0, R]
    const p3: Vec3 = [R, 0, R]

    const err = maxApproxError(roads, p0, c1, c2, p3)
    expect(err).toBeLessThan(0.25)
  })

  test('tight U-turn (~50m radius) stays within 0.25m tolerance after subdivision', () => {
    const k = (4 / 3) * Math.tan(Math.PI / 4)
    const R = 50
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: k * R, y: 0 }
    const a1 = makeAnchor({ x: 0, y: 2 * R })
    a1.inHandle = { x: k * R, y: 2 * R }

    const p = makePath(a0)
    p.anchors.push(a1)

    const roads = pathToRoads(p)
    expect(roads.length).toBeGreaterThan(2)

    const p0: Vec3 = [0, 0, 0]
    const c1: Vec3 = [k * R, 0, 0]
    const c2: Vec3 = [k * R, 0, 2 * R]
    const p3: Vec3 = [0, 0, 2 * R]

    const err = maxApproxError(roads, p0, c1, c2, p3)
    expect(err).toBeLessThan(0.25)
  })

  test('gentle S-curve (~300m effective radius) stays within 0.25m tolerance after subdivision', () => {
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 0, y: 66 }
    const a1 = makeAnchor({ x: 100, y: 200 })
    a1.inHandle = { x: 100, y: 134 }

    const p = makePath(a0)
    p.anchors.push(a1)

    const roads = pathToRoads(p)
    expect(roads.length).toBeGreaterThan(1)

    const p0: Vec3 = [0, 0, 0]
    const c1: Vec3 = [0, 0, 66]
    const c2: Vec3 = [100, 0, 134]
    const p3: Vec3 = [100, 0, 200]

    const err = maxApproxError(roads, p0, c1, c2, p3)
    expect(err).toBeLessThan(0.25)
  })

  test('adjacent roads share miter edges at the join', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))

    const roads = pathToRoads(p)
    expect(roads).toHaveLength(2)
    const a = roads[0]!
    const b = roads[1]!
    expect(a.endLeftEdge).toBeDefined()
    expect(a.endRightEdge).toBeDefined()
    expect(b.startLeftEdge).toEqual(a.endLeftEdge!)
    expect(b.startRightEdge).toEqual(a.endRightEdge!)
  })

  test('closed path shares miter edge between last and first segment', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))
    p.anchors.push(makeAnchor({ x: 0, y: 100 }))
    p.closed = true

    const roads = pathToRoads(p)
    const first = roads[0]!
    const last = roads[roads.length - 1]!
    expect(last.endLeftEdge).toEqual(first.startLeftEdge!)
    expect(last.endRightEdge).toEqual(first.startRightEdge!)
  })

  test('straight 90-degree corner: miter edge extends beyond half-width', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))

    const roads = pathToRoads(p)
    const join = roads[0]!.endPoint!
    const leftEdge = roads[0]!.endLeftEdge!
    const dist = Math.hypot(leftEdge[0] - join[0], leftEdge[2] - join[2])
    expect(dist).toBeGreaterThan(TRACK_WIDTH / 2 - 0.001)
  })

  test('subdivision chain is contiguous — each piece end equals next piece start', () => {
    const k = (4 / 3) * Math.tan(Math.PI / 8)
    const R = 100
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 0, y: k * R }
    const a1 = makeAnchor({ x: R, y: R })
    a1.inHandle = { x: R - k * R, y: R }

    const p = makePath(a0)
    p.anchors.push(a1)

    const roads = pathToRoads(p)
    for (let i = 1; i < roads.length; i++) {
      const prev = roads[i - 1]!
      const curr = roads[i]!
      expect(prev.endPoint![0]).toBeCloseTo(curr.startPoint![0], 6)
      expect(prev.endPoint![1]).toBeCloseTo(curr.startPoint![1], 6)
      expect(prev.endPoint![2]).toBeCloseTo(curr.startPoint![2], 6)
    }
  })
})
