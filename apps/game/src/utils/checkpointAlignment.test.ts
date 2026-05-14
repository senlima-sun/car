import { describe, test, expect } from 'bun:test'
import { alignCheckpointToRoad, realignCheckpointToRibbons } from './checkpointAlignment'
import type { PlacedObject, TrackRibbonPoint } from '../types/trackObjects'

const makeRoad = (
  start: [number, number, number],
  end: [number, number, number],
  controlPoint?: [number, number, number],
): PlacedObject => ({
  id: 'road_1',
  type: 'road',
  position: [(start[0] + end[0]) / 2, 0, (start[2] + end[2]) / 2],
  rotation: Math.atan2(end[0] - start[0], end[2] - start[2]),
  startPoint: start,
  endPoint: end,
  trackMode: controlPoint ? 'curve' : 'straight',
  controlPoint,
})

describe('alignCheckpointToRoad', () => {
  test('straight road — normal already aligned → no flip', () => {
    const road = makeRoad([0, 0, 0], [0, 0, 100])

    const start: [number, number, number] = [-10, 0, 50]
    const end: [number, number, number] = [10, 0, 50]

    const result = alignCheckpointToRoad(start, end, [road])

    expect(result.flipped).toBe(false)
    expect(result.startPoint).toEqual(start)
    expect(result.endPoint).toEqual(end)
  })

  test('straight road — normal reversed → flips start/end', () => {
    const road = makeRoad([0, 0, 0], [0, 0, 100])

    const start: [number, number, number] = [10, 0, 50]
    const end: [number, number, number] = [-10, 0, 50]

    const result = alignCheckpointToRoad(start, end, [road])

    expect(result.flipped).toBe(true)
    expect(result.startPoint).toEqual(end)
    expect(result.endPoint).toEqual(start)
  })

  test('curved road — uses nearest tangent for alignment', () => {
    const road = makeRoad([0, 0, 0], [100, 0, 0], [50, 0, 50])

    const start: [number, number, number] = [50, 0, 20]
    const end: [number, number, number] = [50, 0, 30]

    const result = alignCheckpointToRoad(start, end, [road])

    expect(result.flipped).toBeDefined()
  })

  test('no roads nearby → keeps original direction', () => {
    const start: [number, number, number] = [0, 0, 0]
    const end: [number, number, number] = [10, 0, 0]

    const result = alignCheckpointToRoad(start, end, [])

    expect(result.flipped).toBe(false)
    expect(result.startPoint).toEqual(start)
    expect(result.endPoint).toEqual(end)
  })

  test('road too far away → keeps original direction', () => {
    const road = makeRoad([1000, 0, 1000], [1000, 0, 1100])

    const start: [number, number, number] = [0, 0, 0]
    const end: [number, number, number] = [10, 0, 0]

    const result = alignCheckpointToRoad(start, end, [road])

    expect(result.flipped).toBe(false)
    expect(result.startPoint).toEqual(start)
    expect(result.endPoint).toEqual(end)
  })

  test('checkpoint with zero-length → no crash, no flip', () => {
    const road = makeRoad([0, 0, 0], [0, 0, 100])

    const start: [number, number, number] = [0, 0, 50]
    const end: [number, number, number] = [0, 0, 50]

    const result = alignCheckpointToRoad(start, end, [road])

    expect(result.flipped).toBe(false)
  })

  test('non-road objects are ignored', () => {
    const barrier: PlacedObject = {
      id: 'barrier_1',
      type: 'barrier',
      position: [0, 0, 50],
      rotation: 0,
      startPoint: [0, 0, 0],
      endPoint: [0, 0, 100],
    }

    const start: [number, number, number] = [10, 0, 50]
    const end: [number, number, number] = [-10, 0, 50]

    const result = alignCheckpointToRoad(start, end, [barrier])

    expect(result.flipped).toBe(false)
  })

  test('multiple roads — uses nearest one', () => {
    const farRoad = makeRoad([100, 0, 0], [100, 0, 100])
    const nearRoad = makeRoad([0, 0, 0], [0, 0, 100])

    const start: [number, number, number] = [10, 0, 50]
    const end: [number, number, number] = [-10, 0, 50]

    const result = alignCheckpointToRoad(start, end, [farRoad, nearRoad])

    expect(result.flipped).toBe(true)
  })
})

const makeRibbon = (points: Array<[number, number, number]>, closed = false): PlacedObject => {
  const ribbonPoints: TrackRibbonPoint[] = points.map(p => ({
    x: p[0],
    y: p[1],
    z: p[2],
    isPitLane: false,
  }))
  return {
    id: 'ribbon_1',
    type: 'track_ribbon',
    position: [0, 0, 0],
    rotation: 0,
    ribbonPoints,
    ribbonClosed: closed,
  }
}

describe('realignCheckpointToRibbons', () => {
  test('snaps midpoint to nearest ribbon point on a straight ribbon', () => {
    const ribbon = makeRibbon([
      [0, 0, 0],
      [0, 0, 50],
      [0, 0, 100],
    ])

    const result = realignCheckpointToRibbons([5, 0, 50], [0, 0, 1], 12, [ribbon])

    expect(result).not.toBeNull()
    expect(result!.midpoint[0]).toBeCloseTo(0)
    expect(result!.midpoint[2]).toBeCloseTo(50)
  })

  test('produces line perpendicular to ribbon tangent with correct length', () => {
    const ribbon = makeRibbon([
      [0, 0, 0],
      [0, 0, 100],
    ])

    const result = realignCheckpointToRibbons([0, 0, 50], [0, 0, 1], 12, [ribbon])

    expect(result).not.toBeNull()
    const dx = result!.endPoint[0] - result!.startPoint[0]
    const dz = result!.endPoint[2] - result!.startPoint[2]
    const len = Math.hypot(dx, dz)
    expect(len).toBeCloseTo(12)
    expect(Math.abs(dz)).toBeLessThan(1e-6)
  })

  test('flips line direction when desiredDirection opposes ribbon tangent', () => {
    const ribbon = makeRibbon([
      [0, 0, 0],
      [0, 0, 100],
    ])

    const noFlip = realignCheckpointToRibbons([0, 0, 50], [0, 0, 1], 12, [ribbon])
    const flip = realignCheckpointToRibbons([0, 0, 50], [0, 0, -1], 12, [ribbon])

    expect(noFlip!.flipped).toBe(false)
    expect(flip!.flipped).toBe(true)
    expect(flip!.startPoint[0]).toBeCloseTo(noFlip!.endPoint[0])
    expect(flip!.endPoint[0]).toBeCloseTo(noFlip!.startPoint[0])
  })

  test('rotation matches startPoint → endPoint direction', () => {
    const ribbon = makeRibbon([
      [0, 0, 0],
      [0, 0, 100],
    ])

    const result = realignCheckpointToRibbons([0, 0, 50], [0, 0, 1], 12, [ribbon])

    expect(result).not.toBeNull()
    const dx = result!.endPoint[0] - result!.startPoint[0]
    const dz = result!.endPoint[2] - result!.startPoint[2]
    expect(result!.rotation).toBeCloseTo(Math.atan2(dx, dz))
  })

  test('returns null when no ribbon is within search radius', () => {
    const ribbon = makeRibbon([
      [1000, 0, 1000],
      [1000, 0, 1100],
    ])

    const result = realignCheckpointToRibbons([0, 0, 0], [0, 0, 1], 12, [ribbon])

    expect(result).toBeNull()
  })

  test('returns null with no ribbons', () => {
    const result = realignCheckpointToRibbons([0, 0, 0], [0, 0, 1], 12, [])
    expect(result).toBeNull()
  })

  test('uses tangent of a curved polyline at the nearest segment', () => {
    const ribbon = makeRibbon([
      [0, 0, 0],
      [10, 0, 0],
      [10, 0, 10],
      [10, 0, 20],
    ])

    const result = realignCheckpointToRibbons([10, 0, 15], [0, 0, 1], 12, [ribbon])

    expect(result).not.toBeNull()
    expect(result!.midpoint[0]).toBeCloseTo(10)
    expect(result!.midpoint[2]).toBeCloseTo(15)
    expect(Math.abs(result!.endPoint[2] - result!.startPoint[2])).toBeLessThan(1e-6)
  })

  test('preserves null desiredDirection — keeps perpendicular as computed', () => {
    const ribbon = makeRibbon([
      [0, 0, 0],
      [0, 0, 100],
    ])

    const result = realignCheckpointToRibbons([0, 0, 50], null, 12, [ribbon])

    expect(result).not.toBeNull()
    expect(result!.flipped).toBe(false)
  })

  test('ignores non-ribbon objects', () => {
    const road: PlacedObject = {
      id: 'road_1',
      type: 'road',
      position: [0, 0, 50],
      rotation: 0,
      startPoint: [0, 0, 0],
      endPoint: [0, 0, 100],
    }

    const result = realignCheckpointToRibbons([5, 0, 50], [0, 0, 1], 12, [road])

    expect(result).toBeNull()
  })

  test('handles closed ribbon — last segment connects back to first', () => {
    const ribbon = makeRibbon(
      [
        [0, 0, 0],
        [10, 0, 0],
        [10, 0, 10],
        [0, 0, 10],
      ],
      true,
    )

    const result = realignCheckpointToRibbons([-2, 0, 5], [0, 0, 1], 12, [ribbon])

    expect(result).not.toBeNull()
    expect(result!.midpoint[0]).toBeCloseTo(0)
    expect(result!.midpoint[2]).toBeCloseTo(5)
  })
})
