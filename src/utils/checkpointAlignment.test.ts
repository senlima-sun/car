import { describe, test, expect } from 'bun:test'
import { alignCheckpointToRoad } from './checkpointAlignment'
import type { PlacedObject } from '../types/trackObjects'

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
