import { describe, expect, test } from 'bun:test'
import { resolveParentDerivedLayer } from './parentDerivedLayer'
import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'

function makeRibbon(points: TrackRibbonPoint[], closed = false, width = 12): PlacedObject {
  return {
    id: 'parent-1',
    type: 'track_ribbon',
    position: [0, 0, 0],
    rotation: 0,
    ribbonPoints: points,
    ribbonClosed: closed,
    width,
  }
}

function makeDerived(overrides: Partial<PlacedObject>): PlacedObject {
  return {
    id: 'derived-1',
    type: 'painted_area',
    position: [0, 0, 0],
    rotation: 0,
    parentRibbonId: 'parent-1',
    parentSide: 'left',
    innerOffset: 0,
    derivedWidth: 3,
    ...overrides,
  }
}

const STRAIGHT: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: false },
  { x: 5, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 0, isPitLane: false },
]

const CLOSED_SQUARE: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: false },
  { x: 100, y: 0, z: 0, isPitLane: false },
  { x: 100, y: 0, z: 100, isPitLane: false },
  { x: 0, y: 0, z: 100, isPitLane: false },
]

describe('resolveParentDerivedLayer', () => {
  test('returns null when parentRibbonId is missing', () => {
    const placed: PlacedObject = {
      id: 'x',
      type: 'painted_area',
      position: [0, 0, 0],
      rotation: 0,
    }
    expect(resolveParentDerivedLayer(placed, { parent: undefined })).toBeNull()
  })

  test('returns null when parent is not found (parent ctx)', () => {
    const placed = makeDerived({})
    expect(resolveParentDerivedLayer(placed, { parent: undefined })).toBeNull()
  })

  test('returns null when parent is not found (allObjects ctx)', () => {
    const placed = makeDerived({})
    expect(resolveParentDerivedLayer(placed, { allObjects: [] })).toBeNull()
  })

  test('left side places derived band perpendicular to tangent at halfWidth + offset + halfDerived', () => {
    const parent = makeRibbon(STRAIGHT, false, 12)
    const placed = makeDerived({ parentSide: 'left', innerOffset: 0, derivedWidth: 3 })
    const result = resolveParentDerivedLayer(placed, { parent })!
    expect(result.points.length).toBe(3)
    for (const p of result.points) {
      expect(p.z).toBeCloseTo(7.5, 5)
    }
    expect(result.width).toBe(3)
  })

  test('right side mirrors via sign flip', () => {
    const parent = makeRibbon(STRAIGHT, false, 12)
    const placed = makeDerived({ parentSide: 'right' })
    const result = resolveParentDerivedLayer(placed, { parent })!
    for (const p of result.points) {
      expect(p.z).toBeCloseTo(-7.5, 5)
    }
  })

  test('closed loop parent + tRange [0.25, 0.75] returns middle half', () => {
    const parent = makeRibbon(CLOSED_SQUARE, true, 12)
    const placed = makeDerived({ tRange: [0.25, 0.75] })
    const result = resolveParentDerivedLayer(placed, { parent })!
    expect(result.points.length).toBeGreaterThan(0)
    expect(result.points.length).toBeLessThan(CLOSED_SQUARE.length)
    expect(result.closed).toBe(false)
  })

  test('full-range closed parent yields closed derived layer', () => {
    const parent = makeRibbon(CLOSED_SQUARE, true, 12)
    const placed = makeDerived({ tRange: [0, 1] })
    const result = resolveParentDerivedLayer(placed, { parent })!
    expect(result.closed).toBe(true)
  })

  test('terrainHeightAt overrides derived y values', () => {
    const parent = makeRibbon(STRAIGHT, false, 12)
    const placed = makeDerived({})
    const result = resolveParentDerivedLayer(
      placed,
      { parent },
      { terrainHeightAt: () => 4.2 },
    )!
    for (const p of result.points) {
      expect(p.y).toBeCloseTo(4.2, 5)
    }
  })

  test('resampleSpacing densifies parent walk', () => {
    const parent = makeRibbon(STRAIGHT, false, 12)
    const placed = makeDerived({})
    const dense = resolveParentDerivedLayer(placed, { parent }, { resampleSpacing: 0.5 })!
    expect(dense.points.length).toBeGreaterThan(STRAIGHT.length)
  })

  test('innerOffset shifts derived center outward', () => {
    const parent = makeRibbon(STRAIGHT, false, 12)
    const placed = makeDerived({ parentSide: 'left', innerOffset: 2, derivedWidth: 1 })
    const result = resolveParentDerivedLayer(placed, { parent })!
    for (const p of result.points) {
      expect(p.z).toBeCloseTo(6 + 2 + 0.5, 5)
    }
  })

  test('allObjects ctx finds parent by id', () => {
    const parent = makeRibbon(STRAIGHT, false, 12)
    const placed = makeDerived({})
    const result = resolveParentDerivedLayer(placed, { allObjects: [placed, parent] })!
    expect(result.points.length).toBeGreaterThan(0)
  })
})
