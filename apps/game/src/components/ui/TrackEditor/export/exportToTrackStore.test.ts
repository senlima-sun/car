import { afterEach, describe, expect, test } from 'bun:test'
import { buildExportPayload } from './exportToTrackStore'
import { makeAnchor, makePath } from '../geometry/path'
import type { CheckpointMarker } from '../geometry/types'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { useTerrainStore } from '@/stores/useTerrainStore'

const originalGetHeightAt = useTerrainStore.getState().getHeightAt

afterEach(() => {
  useTerrainStore.setState({ getHeightAt: originalGetHeightAt })
})

describe('buildExportPayload', () => {
  test('returns roads with forward flowDirection by default', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: [],
      raceDirection: 'forward',
    })

    const roads = payload.filter(o => o.type === 'track_ribbon')
    expect(roads.length).toBeGreaterThan(0)
    for (const r of roads) {
      expect(r.flowDirection).toBe('forward')
    }
  })

  test('applies backward flowDirection to every road when raceDirection is backward', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: [],
      raceDirection: 'backward',
    })

    const roads = payload.filter(o => o.type === 'track_ribbon')
    for (const r of roads) {
      expect(r.flowDirection).toBe('backward')
    }
  })

  test('emits start-finish checkpoint as PlacedObject with correct type', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    const cp: CheckpointMarker = {
      id: 'cp1',
      kind: 'start-finish',
      pathId: p.id,
      segmentIndex: 0,
      t: 0.5,
    }

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: [cp],
      raceDirection: 'forward',
    })

    const sf = payload.find(o => o.type === 'checkpoint' && o.checkpointType === 'start-finish')
    expect(sf).toBeDefined()
    expect(sf!.width).toBe(TRACK_WIDTH)
    expect(sf!.position).toEqual([50, 0, 0])
  })

  test('assigns sector order 1, 2, 3 in insertion order', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 300, y: 0 }))

    const sectors: CheckpointMarker[] = [
      { id: 'a', kind: 'sector', pathId: p.id, segmentIndex: 0, t: 0.25 },
      { id: 'b', kind: 'sector', pathId: p.id, segmentIndex: 0, t: 0.5 },
      { id: 'c', kind: 'sector', pathId: p.id, segmentIndex: 0, t: 0.75 },
    ]

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: sectors,
      raceDirection: 'forward',
    })

    const orders = payload
      .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
      .map(o => o.checkpointOrder)
    expect(orders).toEqual([1, 2, 3])
  })

  test('checkpoint startPoint and endPoint are perpendicular to path tangent', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    const cp: CheckpointMarker = {
      id: 'cp1',
      kind: 'start-finish',
      pathId: p.id,
      segmentIndex: 0,
      t: 0.5,
    }

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: [cp],
      raceDirection: 'forward',
    })

    const sf = payload.find(o => o.type === 'checkpoint')!
    const [sx, , sz] = sf.startPoint!
    const [ex, , ez] = sf.endPoint!
    expect(sx).toBeCloseTo(50, 3)
    expect(ex).toBeCloseTo(50, 3)
    expect(Math.abs(sz - ez)).toBeCloseTo(TRACK_WIDTH, 3)
  })

  test('checkpoints inherit flowDirection from raceDirection', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const forward = buildExportPayload({
      paths: [p],
      checkpoints: [
        { id: 'cp1', kind: 'start-finish', pathId: p.id, segmentIndex: 0, t: 0.5 },
        { id: 'cp2', kind: 'sector', pathId: p.id, segmentIndex: 0, t: 0.7 },
      ],
      raceDirection: 'forward',
    })
    for (const cp of forward.filter(o => o.type === 'checkpoint')) {
      expect(cp.flowDirection).toBe('forward')
    }

    const backward = buildExportPayload({
      paths: [p],
      checkpoints: [{ id: 'cp1', kind: 'start-finish', pathId: p.id, segmentIndex: 0, t: 0.5 }],
      raceDirection: 'backward',
    })
    const sf = backward.find(o => o.type === 'checkpoint')!
    expect(sf.flowDirection).toBe('backward')
  })

  test('pit box areas become pitbox PlacedObjects', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: [{ id: 'cp1', kind: 'start-finish', pathId: p.id, segmentIndex: 0, t: 0.5 }],
      raceDirection: 'forward',
      pitBoxAreas: [
        { id: 'pb1', position: { x: 50, y: 20 }, rotation: Math.PI / 4 },
        { id: 'pb2', position: { x: 70, y: 20 }, rotation: 0 },
      ],
    })

    const boxes = payload.filter(o => o.type === 'pitbox')
    expect(boxes).toHaveLength(2)
    expect(boxes[0]!.position).toEqual([50, 0, 20])
    expect(boxes[0]!.rotation).toBeCloseTo(Math.PI / 4)
    expect(boxes[1]!.position).toEqual([70, 0, 20])
  })

  test('checkpoints and pit boxes are emitted with y=0 (y resolved at render time)', () => {
    useTerrainStore.setState({
      getHeightAt: () => 999,
    })

    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: [{ id: 'cp1', kind: 'start-finish', pathId: p.id, segmentIndex: 0, t: 0.5 }],
      raceDirection: 'forward',
      pitBoxAreas: [{ id: 'pb1', position: { x: 50, y: 20 }, rotation: 0 }],
    })

    const sf = payload.find(o => o.type === 'checkpoint')!
    const pitBox = payload.find(o => o.type === 'pitbox')!

    expect(sf.position[1]).toBe(0)
    expect(sf.startPoint![1]).toBe(0)
    expect(sf.endPoint![1]).toBe(0)
    expect(pitBox.position[1]).toBe(0)
  })

  test('checkpoint referencing unknown path is skipped', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    const cp: CheckpointMarker = {
      id: 'cp1',
      kind: 'sector',
      pathId: 'nonexistent',
      segmentIndex: 0,
      t: 0.5,
    }

    const payload = buildExportPayload({
      paths: [p],
      checkpoints: [cp],
      raceDirection: 'forward',
    })

    expect(payload.some(o => o.type === 'checkpoint')).toBe(false)
  })
})
