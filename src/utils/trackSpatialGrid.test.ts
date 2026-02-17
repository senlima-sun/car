import { describe, it, expect } from 'bun:test'
import { TrackSpatialGrid, worldToCell, cellKey } from './trackSpatialGrid'
import type { PlacedObject } from '../types/trackObjects'

function makeObject(overrides: Partial<PlacedObject>): PlacedObject {
  return {
    id: overrides.id ?? `obj_${Math.random().toString(36).slice(2)}`,
    type: overrides.type ?? 'cone',
    position: overrides.position ?? [0, 0, 0],
    rotation: overrides.rotation ?? 0,
    ...overrides,
  }
}

describe('TrackSpatialGrid', () => {
  it('builds empty grid from empty array', () => {
    const grid = new TrackSpatialGrid()
    grid.rebuild([])
    expect(grid.cellCount).toBe(0)
    expect(grid.objectCount).toBe(0)
  })

  it('registers point object (cone) in correct cell', () => {
    const grid = new TrackSpatialGrid()
    const cone = makeObject({ id: 'cone1', type: 'cone', position: [100, 0, 200] })
    grid.rebuild([cone])

    const cx = worldToCell(100)
    const cz = worldToCell(200)
    expect(cx).toBe(2)
    expect(cz).toBe(4)

    const entries = grid.getCellEntries(cellKey(cx, cz))
    expect(entries.length).toBe(1)
    expect(entries[0].objectId).toBe('cone1')
  })

  it('registers linear road across multiple cells', () => {
    const grid = new TrackSpatialGrid()
    const road = makeObject({
      id: 'road1',
      type: 'road',
      position: [60, 0, 0],
      startPoint: [0, 0, 0],
      endPoint: [120, 0, 0],
      trackMode: 'straight',
    })
    grid.rebuild([road])

    const cell00 = grid.getCellEntries(cellKey(0, 0))
    const cell10 = grid.getCellEntries(cellKey(1, 0))
    const cell20 = grid.getCellEntries(cellKey(2, 0))

    expect(cell00.some(e => e.objectId === 'road1')).toBe(true)
    expect(cell10.some(e => e.objectId === 'road1')).toBe(true)
    expect(cell20.some(e => e.objectId === 'road1')).toBe(true)
  })

  it('registers curved road using bezier sampling', () => {
    const grid = new TrackSpatialGrid()
    const road = makeObject({
      id: 'curve1',
      type: 'road',
      position: [50, 0, 50],
      startPoint: [0, 0, 0],
      endPoint: [100, 0, 100],
      controlPoint: [100, 0, 0],
      trackMode: 'curve',
    })
    grid.rebuild([road])

    expect(grid.getCellEntries(cellKey(0, 0)).some(e => e.objectId === 'curve1')).toBe(true)
    expect(grid.getCellEntries(cellKey(2, 2)).some(e => e.objectId === 'curve1')).toBe(true)
    expect(grid.cellCount).toBeGreaterThan(1)
  })

  it('registers polygon object (grass_patch) via AABB', () => {
    const grid = new TrackSpatialGrid()
    const patch = makeObject({
      id: 'grass1',
      type: 'grass_patch',
      position: [25, 0, 25],
      polygonPoints: [
        [0, 0, 0],
        [80, 0, 0],
        [80, 0, 60],
        [0, 0, 60],
      ],
    })
    grid.rebuild([patch])

    expect(grid.getCellEntries(cellKey(0, 0)).some(e => e.objectId === 'grass1')).toBe(true)
    expect(grid.getCellEntries(cellKey(1, 0)).some(e => e.objectId === 'grass1')).toBe(true)
    expect(grid.getCellEntries(cellKey(0, 1)).some(e => e.objectId === 'grass1')).toBe(true)
    expect(grid.getCellEntries(cellKey(1, 1)).some(e => e.objectId === 'grass1')).toBe(true)
  })

  it('maps curb to parent road cells', () => {
    const grid = new TrackSpatialGrid()
    const road = makeObject({
      id: 'road1',
      type: 'road',
      position: [60, 0, 0],
      startPoint: [0, 0, 0],
      endPoint: [120, 0, 0],
      trackMode: 'straight',
    })
    const curb = makeObject({
      id: 'curb1',
      type: 'curb',
      position: [30, 0, 5],
      parentRoadId: 'road1',
    })
    grid.rebuild([road, curb])

    const children = grid.getChildIds('road1')
    expect(children).toContain('curb1')

    const roadCells = grid.getCellEntries(cellKey(0, 0))
    expect(roadCells.some(e => e.objectId === 'curb1')).toBe(true)
  })

  it('stores correct object positions', () => {
    const grid = new TrackSpatialGrid()
    const cone = makeObject({ id: 'c1', type: 'cone', position: [10, 5, 20] })
    const road = makeObject({
      id: 'r1',
      type: 'road',
      position: [50, 0, 0],
      startPoint: [0, 0, 0],
      endPoint: [100, 0, 0],
      trackMode: 'straight',
    })
    grid.rebuild([cone, road])

    const conePos = grid.getObjectPosition('c1')
    expect(conePos?.x).toBe(10)
    expect(conePos?.z).toBe(20)

    const roadPos = grid.getObjectPosition('r1')
    expect(roadPos?.x).toBe(50)
    expect(roadPos?.z).toBe(0)
  })

  it('rebuilds grid cleanly', () => {
    const grid = new TrackSpatialGrid()
    const objs1 = [makeObject({ id: 'a', type: 'cone', position: [10, 0, 10] })]
    grid.rebuild(objs1)
    expect(grid.objectCount).toBe(1)

    const objs2 = [
      makeObject({ id: 'b', type: 'cone', position: [100, 0, 100] }),
      makeObject({ id: 'c', type: 'ramp', position: [200, 0, 200] }),
    ]
    grid.rebuild(objs2)
    expect(grid.objectCount).toBe(2)
    expect(grid.getObjectPosition('a')).toBeUndefined()
    expect(grid.getObjectPosition('b')).toBeDefined()
  })

  it('queries ellipse cells correctly', () => {
    const grid = new TrackSpatialGrid()
    const keys = grid.queryCellsInEllipse(0, 0, 0, 100, 50, 75)
    expect(keys.length).toBeGreaterThan(0)
    expect(keys).toContain(cellKey(0, 0))
  })

  it('handles checkpoint object with start/end points', () => {
    const grid = new TrackSpatialGrid()
    const cp = makeObject({
      id: 'cp1',
      type: 'checkpoint',
      position: [25, 0, 0],
      startPoint: [0, 0, -6],
      endPoint: [50, 0, -6],
      checkpointType: 'start-finish',
    })
    grid.rebuild([cp])

    expect(grid.getCellEntries(cellKey(0, -1)).some(e => e.objectId === 'cp1')).toBe(true)
    expect(grid.getCellEntries(cellKey(1, -1)).some(e => e.objectId === 'cp1')).toBe(true)
  })
})
