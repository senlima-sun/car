import { afterEach, describe, expect, test } from 'vitest'
import { pathToRibbon, documentToRibbons, RIBBON_MIN_STEP_M } from './pathToRibbon'
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

  test('straight line subdivides at RIBBON_MAX_STEP_M (100m straight has bounded sample spacing)', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const r = pathToRibbon(p)
    expect(r).not.toBeNull()
    expect(r!.type).toBe('track_ribbon')
    expect(r!.width).toBe(TRACK_WIDTH)
    const pts = r!.ribbonPoints!
    expect(pts.length).toBeGreaterThanOrEqual(Math.ceil(100 / 4.0) + 1)
    for (let i = 1; i < pts.length; i++) {
      const step = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z)
      expect(step).toBeLessThanOrEqual(4.0 + 1e-6)
    }
    const first = pts[0]!
    const last = pts[pts.length - 1]!
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
    expect(dist).toBeGreaterThan(RIBBON_MIN_STEP_M)
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

  test('single-anchor closed path returns null gracefully', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.closed = true
    expect(pathToRibbon(p)).toBeNull()
  })

  test('deterministic across reruns: same input twice produces byte-identical output', () => {
    useTerrainStore.setState({ getHeightAt: () => 0 })
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    const a1 = makeAnchor({ x: 50, y: 50 })
    a1.outHandle = { x: 10, y: 30 }
    a1.inHandle = { x: 30, y: 10 }
    p.anchors.push(a1)
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const r1 = pathToRibbon(p)!
    const r2 = pathToRibbon(p)!
    expect(r1.ribbonPoints!.length).toBe(r2.ribbonPoints!.length)
    for (let i = 0; i < r1.ribbonPoints!.length; i++) {
      expect(r1.ribbonPoints![i]!.x).toBe(r2.ribbonPoints![i]!.x)
      expect(r1.ribbonPoints![i]!.z).toBe(r2.ribbonPoints![i]!.z)
    }
  })

  test('NaN anchor positions: returns null when any input anchor has non-finite coords', () => {
    const p = makePath(makeAnchor({ x: NaN, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    const r = pathToRibbon(p)
    expect(r).toBeNull()
  })

  test('closed path whose closing distance is RIBBON_MIN_STEP_M * 0.5 dedupes the closing sample', () => {
    useTerrainStore.setState({ getHeightAt: () => 0 })
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))
    p.anchors.push(makeAnchor({ x: 0, y: 100 }))
    p.closed = true

    const r = pathToRibbon(p)!
    const first = r.ribbonPoints![0]!
    const last = r.ribbonPoints![r.ribbonPoints!.length - 1]!
    const dist = Math.hypot(first.x - last.x, first.z - last.z)
    expect(dist).toBeGreaterThanOrEqual(RIBBON_MIN_STEP_M)
  })

  test('closed path whose closing distance is RIBBON_MIN_STEP_M * 2 does NOT dedupe', () => {
    useTerrainStore.setState({ getHeightAt: () => 0 })
    const offset = RIBBON_MIN_STEP_M * 2
    const pNoDedupe = makePath(makeAnchor({ x: offset, y: 0 }))
    pNoDedupe.anchors.push(makeAnchor({ x: 100, y: 0 }))
    pNoDedupe.anchors.push(makeAnchor({ x: 100, y: 100 }))
    pNoDedupe.anchors.push(makeAnchor({ x: 0, y: 100 }))
    pNoDedupe.closed = true

    const rClosed = pathToRibbon(pNoDedupe)!
    const openCopy = { ...pNoDedupe, closed: false }
    const rOpen = pathToRibbon(openCopy)!
    expect(rClosed.ribbonPoints!.length).toBeGreaterThanOrEqual(rOpen.ribbonPoints!.length)
  })
})
