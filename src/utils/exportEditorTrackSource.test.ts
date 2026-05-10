import { describe, expect, test } from 'bun:test'
import { makeAnchor, makePath } from '@/components/ui/TrackEditor/geometry/path'
import { buildRuntimePresetTrack } from './editorTrackSource'
import { buildEditorTrackSource } from './exportEditorTrackSource'

function makeSquarePath(): ReturnType<typeof makePath> {
  const path = makePath(makeAnchor({ x: 0, y: 0 }))
  path.anchors.push(makeAnchor({ x: 100, y: 0 }))
  path.anchors.push(makeAnchor({ x: 100, y: 100 }))
  path.anchors.push(makeAnchor({ x: 0, y: 100 }))
  path.closed = true
  return path
}

describe('buildEditorTrackSource', () => {
  test('passes id and name through unchanged', () => {
    const path = makeSquarePath()
    const source = buildEditorTrackSource({
      id: 'f1_test',
      name: 'Test Track',
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
    })
    expect(source.id).toBe('f1_test')
    expect(source.name).toBe('Test Track')
  })

  test('trackLength is within 1% of geometric perimeter', () => {
    const path = makeSquarePath()
    const source = buildEditorTrackSource({
      id: 'f1_test',
      name: 'Test',
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
    })
    const expected = 400
    expect(source.trackLength).toBeGreaterThan(expected * 0.99)
    expect(source.trackLength).toBeLessThan(expected * 1.01)
  })

  test('output round-trips through buildRuntimePresetTrack', () => {
    const path = makeSquarePath()
    const source = buildEditorTrackSource({
      id: 'f1_test',
      name: 'Test',
      paths: [path],
      checkpoints: [
        { id: 'sf', kind: 'start-finish', pathId: path.id, segmentIndex: 0, t: 0.5 },
      ],
      raceDirection: 'forward',
    })
    const runtime = buildRuntimePresetTrack(source)
    expect(runtime.objects.length).toBeGreaterThan(0)
    expect(runtime.objects.some(o => o.type === 'track_ribbon')).toBe(true)
    expect(runtime.objects.some(o => o.type === 'checkpoint')).toBe(true)
  })

  test('omits empty pitBoxAreas and curbs', () => {
    const source = buildEditorTrackSource({
      id: 'f1_test',
      name: 'Test',
      paths: [makeSquarePath()],
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
      curbs: [],
    })
    expect(source.pitBoxAreas).toBeUndefined()
    expect(source.curbs).toBeUndefined()
  })

  test('rounds anchor coordinates to 4 decimals', () => {
    const path = makePath(makeAnchor({ x: 0.123456789, y: 0.987654321 }))
    path.anchors.push(makeAnchor({ x: 100.555555, y: 0 }))
    const source = buildEditorTrackSource({
      id: 'f1_test',
      name: 'Test',
      paths: [path],
      checkpoints: [],
      raceDirection: 'forward',
    })
    const firstAnchor = source.paths[0]!.anchors[0]!
    if ('point' in firstAnchor) {
      expect(firstAnchor.point.x).toBe(0.1235)
      expect(firstAnchor.point.y).toBe(0.9877)
    } else {
      throw new Error('expected inline anchor')
    }
  })
})
