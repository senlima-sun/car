import { describe, expect, test } from 'bun:test'
import { buildEditorTrackSourceFromPolyline } from './editorTrackSourceFromPolyline'

describe('buildEditorTrackSourceFromPolyline', () => {
  test('builds a closed source and normalizes duplicate terminal point', () => {
    const source = buildEditorTrackSourceFromPolyline({
      id: 'test_loop',
      name: 'Test Loop',
      trackLength: 400,
      turns: 4,
      points: [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
        { x: 100, z: 100 },
        { x: 0, z: 100 },
        { x: 0, z: 0 },
      ],
      sectorSplits: [0.33, 0.66],
      startFinishFraction: 0,
    })

    expect(source.paths).toHaveLength(1)
    expect(source.paths[0]!.closed).toBe(true)
    expect(source.paths[0]!.anchors).toHaveLength(4)
    expect(source.checkpoints).toHaveLength(3)
  })

  test('builds an open source when closure is not implied', () => {
    const source = buildEditorTrackSourceFromPolyline({
      id: 'test_open',
      name: 'Test Open',
      trackLength: 300,
      turns: 3,
      points: [
        { x: 0, z: 0 },
        { x: 100, z: 0 },
        { x: 200, z: 50 },
      ],
      sectorSplits: [0.25, 0.75],
      startFinishFraction: 0.1,
    })

    expect(source.paths[0]!.closed).toBe(false)
    expect(source.checkpoints[0]!.segmentIndex).toBe(0)
  })
})
