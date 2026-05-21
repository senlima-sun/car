import { describe, expect, test } from 'vitest'
import { buildRoadCorridorsFromObjects, corridorFromRibbon } from './roadCorridor'
import type { TrackRibbonPoint } from '../types/trackObjects'

const DEFAULT_WIDTH = 12

function ribbon(points: TrackRibbonPoint[], extra: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    type: 'track_ribbon',
    ribbonPoints: points,
    ribbonClosed: false,
    width: DEFAULT_WIDTH,
    ...extra,
  }
}

describe('buildRoadCorridorsFromObjects', () => {
  test('skips non-ribbon objects', () => {
    const result = buildRoadCorridorsFromObjects(
      [
        { type: 'cone' },
        { type: 'track_ribbon', ribbonPoints: undefined },
      ],
      DEFAULT_WIDTH,
    )
    expect(result).toHaveLength(0)
  })

  test('skips ribbons with fewer than 2 points', () => {
    const result = buildRoadCorridorsFromObjects(
      [ribbon([{ x: 0, y: 0, z: 0, isPitLane: false }])],
      DEFAULT_WIDTH,
    )
    expect(result).toHaveLength(0)
  })

  test('builds straight-line corridor', () => {
    const result = buildRoadCorridorsFromObjects(
      [
        ribbon([
          { x: 0, y: 0, z: 0, isPitLane: false },
          { x: 0, y: 0, z: 50, isPitLane: false },
        ]),
      ],
      DEFAULT_WIDTH,
    )
    expect(result).toHaveLength(1)
    expect(result[0]!.width).toBe(DEFAULT_WIDTH)
    expect(result[0]!.halfWidth).toBe(DEFAULT_WIDTH / 2)
    expect(result[0]!.closed).toBe(false)
    expect(result[0]!.hasPitLane).toBe(false)
    expect(result[0]!.hasAuthoredElevation).toBe(false)
  })

  test('builds curved corridor with multiple samples', () => {
    const points: TrackRibbonPoint[] = []
    for (let i = 0; i < 16; i++) {
      const t = (i / 15) * Math.PI
      points.push({ x: Math.cos(t) * 30, y: 0, z: Math.sin(t) * 30, isPitLane: false })
    }
    const [corridor] = buildRoadCorridorsFromObjects([ribbon(points)], DEFAULT_WIDTH)
    expect(corridor!.centerline.length).toBe(16)
  })

  test('marks closed ribbons', () => {
    const result = buildRoadCorridorsFromObjects(
      [
        ribbon(
          [
            { x: 0, y: 0, z: 0, isPitLane: false },
            { x: 10, y: 0, z: 0, isPitLane: false },
            { x: 10, y: 0, z: 10, isPitLane: false },
            { x: 0, y: 0, z: 10, isPitLane: false },
          ],
          { ribbonClosed: true },
        ),
      ],
      DEFAULT_WIDTH,
    )
    expect(result[0]!.closed).toBe(true)
  })

  test('detects pit-lane segments', () => {
    const result = buildRoadCorridorsFromObjects(
      [
        ribbon([
          { x: 0, y: 0, z: 0, isPitLane: false },
          { x: 0, y: 0, z: 25, isPitLane: true },
          { x: 0, y: 0, z: 50, isPitLane: true },
          { x: 0, y: 0, z: 75, isPitLane: false },
        ]),
      ],
      DEFAULT_WIDTH,
    )
    expect(result[0]!.hasPitLane).toBe(true)
  })

  test('uses default width when ribbon width missing or non-positive', () => {
    const fallback = buildRoadCorridorsFromObjects(
      [
        {
          id: 'a',
          type: 'track_ribbon',
          ribbonPoints: [
            { x: 0, y: 0, z: 0, isPitLane: false },
            { x: 0, y: 0, z: 10, isPitLane: false },
          ],
        },
        {
          id: 'b',
          type: 'track_ribbon',
          ribbonPoints: [
            { x: 0, y: 0, z: 0, isPitLane: false },
            { x: 0, y: 0, z: 10, isPitLane: false },
          ],
          width: 0,
        },
      ],
      DEFAULT_WIDTH,
    )
    expect(fallback.map(c => c.width)).toEqual([DEFAULT_WIDTH, DEFAULT_WIDTH])
  })

  test('detects fully authored elevation', () => {
    const result = buildRoadCorridorsFromObjects(
      [
        ribbon([
          { x: 0, y: 0, z: 0, isPitLane: false, elevation: 1 },
          { x: 0, y: 0, z: 10, isPitLane: false, elevation: 2 },
        ]),
      ],
      DEFAULT_WIDTH,
    )
    expect(result[0]!.hasAuthoredElevation).toBe(true)
  })

  test('treats partial elevation as unauthored', () => {
    const result = buildRoadCorridorsFromObjects(
      [
        ribbon([
          { x: 0, y: 0, z: 0, isPitLane: false, elevation: 1 },
          { x: 0, y: 0, z: 10, isPitLane: false },
        ]),
      ],
      DEFAULT_WIDTH,
    )
    expect(result[0]!.hasAuthoredElevation).toBe(false)
  })
})

describe('corridorFromRibbon', () => {
  test('returns null for non-ribbon types', () => {
    expect(corridorFromRibbon({ type: 'cone' }, DEFAULT_WIDTH)).toBeNull()
  })

  test('falls back to indexed id when missing', () => {
    const corridor = corridorFromRibbon(
      {
        type: 'track_ribbon',
        ribbonPoints: [
          { x: 0, y: 0, z: 0, isPitLane: false },
          { x: 0, y: 0, z: 10, isPitLane: false },
        ],
      },
      DEFAULT_WIDTH,
      3,
    )
    expect(corridor!.id).toBe('ribbon-3')
  })
})
