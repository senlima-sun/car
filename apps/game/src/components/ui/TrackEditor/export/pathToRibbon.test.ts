import { afterEach, describe, expect, test } from 'bun:test'
import { pathToRibbon, documentToRibbons } from './pathToRibbon'
import { makeAnchor, makePath } from '../geometry/path'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { useTerrainStore } from '@/stores/useTerrainStore'

const originalGetHeightAt = useTerrainStore.getState().getHeightAt

afterEach(() => {
  useTerrainStore.setState({ getHeightAt: originalGetHeightAt })
})

describe('pathToRibbon', () => {
  test('returns null for paths with fewer than 2 anchors', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    expect(pathToRibbon(p)).toBeNull()
  })

  test('straight line produces ribbon with points spanning both endpoints', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const r = pathToRibbon(p)
    expect(r).not.toBeNull()
    expect(r!.type).toBe('track_ribbon')
    expect(r!.width).toBe(TRACK_WIDTH)
    expect(r!.ribbonPoints!.length).toBeGreaterThan(10)
    const first = r!.ribbonPoints![0]!
    const last = r!.ribbonPoints![r!.ribbonPoints!.length - 1]!
    expect(first.x).toBeCloseTo(0, 1)
    expect(first.z).toBeCloseTo(0, 1)
    expect(last.x).toBeCloseTo(100, 1)
    expect(last.z).toBeCloseTo(0, 1)
  })

  test('maps editor XY to world XZ with y=0', () => {
    const p = makePath(makeAnchor({ x: 10, y: 20 }))
    p.anchors.push(makeAnchor({ x: 30, y: 40 }))

    const r = pathToRibbon(p)!
    for (const pt of r.ribbonPoints!) {
      expect(pt.y).toBe(0)
    }
    expect(r.ribbonPoints![0]!.x).toBeCloseTo(10, 1)
    expect(r.ribbonPoints![0]!.z).toBeCloseTo(20, 1)
  })

  test('samples terrain height into ribbon points and centroid', () => {
    useTerrainStore.setState({
      getHeightAt: (worldX, worldZ) => Number((worldX * 0.1 + worldZ * 0.05).toFixed(4)),
    })

    const p = makePath(makeAnchor({ x: 10, y: 20 }))
    p.anchors.push(makeAnchor({ x: 30, y: 40 }))

    const r = pathToRibbon(p)!
    expect(r.ribbonPoints![0]!.y).toBeCloseTo(2, 4)
    expect(r.ribbonPoints![r.ribbonPoints!.length - 1]!.y).toBeCloseTo(5, 4)
    expect(r.position[1]).toBeGreaterThan(2)
    expect(r.position[1]).toBeLessThan(5)
  })

  test('pitLaneSegments mark corresponding points', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 200, y: 0 }))
    p.anchors.push(makeAnchor({ x: 300, y: 0 }))
    p.pitLaneSegments = [1]

    const r = pathToRibbon(p)!
    const pitPoints = r.ribbonPoints!.filter(pt => pt.isPitLane)
    const nonPitPoints = r.ribbonPoints!.filter(pt => !pt.isPitLane)
    expect(pitPoints.length).toBeGreaterThan(0)
    expect(nonPitPoints.length).toBeGreaterThan(0)
    for (const p of pitPoints) {
      expect(p.x).toBeGreaterThan(99)
      expect(p.x).toBeLessThan(201)
    }
  })

  test('closed path does not duplicate the first point at the end', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))
    p.anchors.push(makeAnchor({ x: 0, y: 100 }))
    p.closed = true

    const r = pathToRibbon(p)!
    expect(r.ribbonClosed).toBe(true)
    const first = r.ribbonPoints![0]!
    const last = r.ribbonPoints![r.ribbonPoints!.length - 1]!
    const dist = Math.hypot(first.x - last.x, first.z - last.z)
    expect(dist).toBeGreaterThan(0.5)
    expect(dist).toBeLessThan(2)
  })

  test('curved segment produces points that stay near the curve', () => {
    const k = (4 / 3) * Math.tan(Math.PI / 8)
    const R = 100
    const a0 = makeAnchor({ x: 0, y: 0 })
    a0.outHandle = { x: 0, y: k * R }
    const a1 = makeAnchor({ x: R, y: R })
    a1.inHandle = { x: R - k * R, y: R }
    const p = makePath(a0)
    p.anchors.push(a1)

    const r = pathToRibbon(p)!
    for (const pt of r.ribbonPoints!) {
      const d = Math.hypot(pt.x - R, pt.z - 0)
      expect(d).toBeGreaterThan(R - 2)
      expect(d).toBeLessThan(R + 2)
    }
  })

  test('documentToRibbons produces one ribbon per path', () => {
    const p1 = makePath(makeAnchor({ x: 0, y: 0 }))
    p1.anchors.push(makeAnchor({ x: 10, y: 0 }))
    const p2 = makePath(makeAnchor({ x: 100, y: 100 }))
    p2.anchors.push(makeAnchor({ x: 200, y: 100 }))

    const ribbons = documentToRibbons([p1, p2])
    expect(ribbons).toHaveLength(2)
  })

  test('position is centroid of points', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const r = pathToRibbon(p)!
    expect(r.position[0]).toBeCloseTo(50, 0)
    expect(r.position[2]).toBeCloseTo(0, 1)
  })
})
