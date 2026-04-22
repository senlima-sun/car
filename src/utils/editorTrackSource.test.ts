import { describe, expect, test } from 'bun:test'
import { makeAnchor, makePath } from '@/components/ui/TrackEditor/geometry/path'
import { buildRuntimePresetTrack, buildTrackObjectsFromEditorSource } from './editorTrackSource'

describe('buildTrackObjectsFromEditorSource', () => {
  test('builds runtime objects from editor-native data', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const objects = buildTrackObjectsFromEditorSource({
      paths: [path],
      checkpoints: [{ id: 'sf', kind: 'start-finish', pathId: path.id, segmentIndex: 0, t: 0.5 }],
      raceDirection: 'forward',
      pitBoxAreas: [{ id: 'pb1', position: { x: 20, y: 10 }, rotation: 0 }],
    })

    expect(objects.some(object => object.type === 'track_ribbon')).toBe(true)
    expect(objects.some(object => object.type === 'checkpoint')).toBe(true)
    expect(objects.some(object => object.type === 'pitbox')).toBe(true)
  })
})

describe('buildRuntimePresetTrack', () => {
  test('preserves preset metadata while generating objects', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const preset = buildRuntimePresetTrack({
      id: 'test_track',
      name: 'Test Track',
      trackLength: 100,
      turns: 1,
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
    })

    expect(preset.id).toBe('test_track')
    expect(preset.name).toBe('Test Track')
    expect(preset.trackLength).toBe(100)
    expect(preset.turns).toBe(1)
    expect(preset.objects.length).toBeGreaterThan(0)
  })
})
