import { describe, expect, test } from 'bun:test'
import { migrateSavedTrackV1ToV2, type SavedTrack } from './track'

function v1Base(): SavedTrack {
  return {
    id: 't1',
    name: 'Spa',
    createdAt: 1,
    updatedAt: 2,
    objectCount: 1,
    objects: [
      {
        id: 'r1',
        type: 'track_ribbon',
        position: [0, 0, 0],
        rotation: 0,
        ribbonPoints: [
          { x: 0, y: 42, z: 0, isPitLane: false },
          { x: 10, y: 50, z: 5, isPitLane: false },
        ],
      },
    ],
  }
}

describe('migrateSavedTrackV1ToV2', () => {
  test('strips ribbon point y values', () => {
    const v2 = migrateSavedTrackV1ToV2(v1Base())
    const ribbon = v2.objects.find(o => o.type === 'track_ribbon')!
    for (const p of ribbon.ribbonPoints!) expect(p.y).toBe(0)
  })

  test('strips curb centerline y values', () => {
    const v1: SavedTrack = {
      ...v1Base(),
      objects: [
        {
          id: 'c1',
          type: 'curb',
          position: [0, 0, 0],
          rotation: 0,
          curbCenterline: [{ x: 0, y: 5, z: 0, isPitLane: false }],
        },
      ],
    }
    const v2 = migrateSavedTrackV1ToV2(v1)
    expect(v2.objects[0]!.curbCenterline![0]!.y).toBe(0)
  })

  test('sidecar source: drops heightmap, sets sidecarApplied', () => {
    const v1: SavedTrack = {
      ...v1Base(),
      presetId: 'f1_spa',
      heightmap: [1, 2, 3],
      heightmapSource: 'sidecar',
    }
    const v2 = migrateSavedTrackV1ToV2(v1)
    expect(v2.sidecarApplied).toBe(true)
    expect(v2.customBaselineUsed).toBe(false)
    expect(v2.deltaPresent).toBe(false)
    expect(v2.baseline).toBeUndefined()
    expect(v2.delta).toBeUndefined()
    expect(v2.heightmapSidecarRef).toBe('f1_spa')
  })

  test('user source: moves heightmap to delta', () => {
    const v1: SavedTrack = {
      ...v1Base(),
      heightmap: [1, 2, 3, 0],
      heightmapSource: 'user',
    }
    const v2 = migrateSavedTrackV1ToV2(v1)
    expect(v2.sidecarApplied).toBe(false)
    expect(v2.customBaselineUsed).toBe(false)
    expect(v2.deltaPresent).toBe(true)
    expect(v2.delta).toEqual([1, 2, 3, 0])
  })

  test('none source: clears all booleans', () => {
    const v1: SavedTrack = { ...v1Base(), heightmapSource: 'none' }
    const v2 = migrateSavedTrackV1ToV2(v1)
    expect(v2.sidecarApplied).toBe(false)
    expect(v2.customBaselineUsed).toBe(false)
    expect(v2.deltaPresent).toBe(false)
  })

  test('preset track with implicit heightmap and no source: routed to delta', () => {
    const v1: SavedTrack = {
      ...v1Base(),
      presetId: 'f1_spa',
      heightmap: [5, 6, 7],
    }
    const v2 = migrateSavedTrackV1ToV2(v1)
    expect(v2.delta).toEqual([5, 6, 7])
    expect(v2.deltaPresent).toBe(true)
    expect(v2.heightmapSidecarRef).toBe('f1_spa')
  })

  test('custom track with implicit heightmap and no source: routed to baseline', () => {
    const v1: SavedTrack = { ...v1Base(), heightmap: [5, 6, 7] }
    const v2 = migrateSavedTrackV1ToV2(v1)
    expect(v2.baseline).toEqual([5, 6, 7])
    expect(v2.customBaselineUsed).toBe(true)
    expect(v2.heightmapSidecarRef).toBeUndefined()
  })

  test('idempotent on v2 tracks', () => {
    const v2 = migrateSavedTrackV1ToV2(v1Base())
    const again = migrateSavedTrackV1ToV2(v2)
    expect(again).toBe(v2)
  })

  test('sets schemaVersion = 2', () => {
    const v2 = migrateSavedTrackV1ToV2(v1Base())
    expect(v2.schemaVersion).toBe(2)
  })

  test('preserves id/name/timestamps/presetId/pitLaneData', () => {
    const v1: SavedTrack = {
      ...v1Base(),
      presetId: 'f1_baku',
      pitLaneData: { foo: 'bar' },
    }
    const v2 = migrateSavedTrackV1ToV2(v1)
    expect(v2.id).toBe(v1.id)
    expect(v2.name).toBe(v1.name)
    expect(v2.createdAt).toBe(v1.createdAt)
    expect(v2.updatedAt).toBe(v1.updatedAt)
    expect(v2.presetId).toBe('f1_baku')
    expect(v2.pitLaneData).toEqual({ foo: 'bar' })
  })
})
