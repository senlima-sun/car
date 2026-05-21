import { describe, expect, test } from 'vitest'
import { getLayerGroup } from './trackLayerGroup'
import type { PlacedObject, TrackRibbonPoint } from '../types/trackObjects'

function makeObject(overrides: Partial<PlacedObject>): PlacedObject {
  return {
    id: 'test',
    type: 'road',
    position: [0, 0, 0],
    rotation: 0,
    ...overrides,
  }
}

describe('getLayerGroup', () => {
  test('explicit layerGroup wins', () => {
    expect(getLayerGroup(makeObject({ layerGroup: 'edge' }))).toBe('edge')
  })

  test('curb -> curb', () => {
    expect(getLayerGroup(makeObject({ type: 'curb' }))).toBe('curb')
  })

  test('painted_area -> painted', () => {
    expect(getLayerGroup(makeObject({ type: 'painted_area' }))).toBe('painted')
  })

  test('road (straight) -> surface', () => {
    expect(getLayerGroup(makeObject({ type: 'road', trackMode: 'straight' }))).toBe('surface')
  })

  test('road (pitroad) -> pit', () => {
    expect(getLayerGroup(makeObject({ type: 'road', trackMode: 'pitroad' }))).toBe('pit')
  })

  test('road (pitroad-curve) -> pit', () => {
    expect(getLayerGroup(makeObject({ type: 'road', trackMode: 'pitroad-curve' }))).toBe('pit')
  })

  test('track_ribbon all pit -> pit', () => {
    const points: TrackRibbonPoint[] = [
      { x: 0, y: 0, z: 0, isPitLane: true },
      { x: 1, y: 0, z: 0, isPitLane: true },
    ]
    expect(getLayerGroup(makeObject({ type: 'track_ribbon', ribbonPoints: points }))).toBe('pit')
  })

  test('track_ribbon mixed -> surface', () => {
    const points: TrackRibbonPoint[] = [
      { x: 0, y: 0, z: 0, isPitLane: true },
      { x: 1, y: 0, z: 0, isPitLane: false },
    ]
    expect(getLayerGroup(makeObject({ type: 'track_ribbon', ribbonPoints: points }))).toBe(
      'surface',
    )
  })

  test('track_ribbon empty -> surface', () => {
    expect(getLayerGroup(makeObject({ type: 'track_ribbon', ribbonPoints: [] }))).toBe('surface')
  })

  test('track_ribbon without ribbonPoints -> null', () => {
    expect(getLayerGroup(makeObject({ type: 'track_ribbon' }))).toBeNull()
  })

  test('non-ribbon objects -> null', () => {
    expect(getLayerGroup(makeObject({ type: 'cone' }))).toBeNull()
    expect(getLayerGroup(makeObject({ type: 'barrier' }))).toBeNull()
    expect(getLayerGroup(makeObject({ type: 'checkpoint' }))).toBeNull()
    expect(getLayerGroup(makeObject({ type: 'corner' }))).toBeNull()
    expect(getLayerGroup(makeObject({ type: 'wall' }))).toBeNull()
  })

  test('edge_line -> edge', () => {
    expect(getLayerGroup(makeObject({ type: 'edge_line' }))).toBe('edge')
  })

  test('parent-anchored edge_line still -> edge', () => {
    expect(
      getLayerGroup(
        makeObject({
          type: 'edge_line',
          parentRibbonId: 'p1',
          parentSide: 'left',
          derivedWidth: 0.2,
        }),
      ),
    ).toBe('edge')
  })
})
