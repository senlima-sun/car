import { describe, expect, test } from 'bun:test'
import { makeAnchor, makePath } from '../geometry/path'
import { buildExportPayload } from '../export/exportToTrackStore'
import {
  fitViewportToEditorState,
  importTrackObjectsToEditorState,
  normalizePresetTrackObjects,
} from './trackObjectsToEditor'

describe('importTrackObjectsToEditorState', () => {
  test('imports ribbon tracks, checkpoints, pit boxes, and race direction', () => {
    const path = makePath(makeAnchor({ x: 0, y: 0 }))
    path.anchors.push(makeAnchor({ x: 120, y: 0 }))
    path.anchors.push(makeAnchor({ x: 120, y: 60 }))
    path.closed = true
    path.pitLaneSegments = [1]

    const objects = buildExportPayload({
      paths: [path],
      checkpoints: [
        { id: 'sf', kind: 'start-finish', pathId: path.id, segmentIndex: 0, t: 0.5 },
        { id: 's1', kind: 'sector', pathId: path.id, segmentIndex: 1, t: 0.4 },
      ],
      raceDirection: 'backward',
      pitBoxAreas: [{ id: 'pb1', position: { x: 100, y: 20 }, rotation: Math.PI / 3 }],
    })

    const imported = importTrackObjectsToEditorState(objects)

    expect(imported.doc.paths).toHaveLength(1)
    expect(imported.doc.paths[0]!.closed).toBe(true)
    expect(imported.doc.paths[0]!.pitLaneSegments?.length).toBeGreaterThan(0)
    expect(imported.checkpoints).toHaveLength(2)
    expect(imported.checkpoints.map(checkpoint => checkpoint.kind)).toEqual([
      'start-finish',
      'sector',
    ])
    expect(imported.raceDirection).toBe('backward')
    expect(imported.pitBoxAreas).toHaveLength(1)
    expect(imported.pitBoxAreas[0]!.position).toEqual({ x: 100, y: 20 })
    expect(imported.pitBoxAreas[0]!.rotation).toBeCloseTo(Math.PI / 3)
  })

  test('fits viewport around imported geometry', () => {
    const path = makePath(makeAnchor({ x: -200, y: -100 }))
    path.anchors.push(makeAnchor({ x: 200, y: 100 }))

    const state = {
      doc: { paths: [path] },
      checkpoints: [],
      raceDirection: 'forward' as const,
      pitBoxAreas: [],
    }

    const viewport = fitViewportToEditorState(state, 1600, 900)

    expect(viewport.zoom).toBeGreaterThan(0.05)
    expect(viewport.pan.x).toBeCloseTo(800, 3)
    expect(viewport.pan.y).toBeCloseTo(450, 3)
  })
})

describe('normalizePresetTrackObjects', () => {
  test('fills missing flowDirection on ribbons and checkpoints', () => {
    const normalized = normalizePresetTrackObjects([
      {
        id: 'r1',
        type: 'track_ribbon',
        position: [0, 0, 0],
        rotation: 0,
        ribbonPoints: [
          { x: 0, y: 0, z: 0, isPitLane: false },
          { x: 100, y: 0, z: 0, isPitLane: false },
        ],
        ribbonClosed: false,
      },
      {
        id: 'cp1',
        type: 'checkpoint',
        position: [50, 0, 0],
        rotation: 0,
        checkpointType: 'start-finish',
      },
    ])

    expect(normalized[0]!.flowDirection).toBe('forward')
    expect(normalized[1]!.flowDirection).toBe('forward')
  })
})
