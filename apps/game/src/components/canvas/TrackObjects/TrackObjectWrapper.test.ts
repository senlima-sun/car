import { describe, expect, test } from 'vitest'
import { shouldRenderRibbonCurbSegment } from './TrackObjectWrapper'
import type { PlacedObject } from '@/types/trackObjects'

function makeObject(overrides: Partial<PlacedObject>): PlacedObject {
  return {
    id: 'object',
    type: 'curb',
    position: [0, 0, 0],
    rotation: 0,
    ...overrides,
  }
}

describe('shouldRenderRibbonCurbSegment', () => {
  test('renders parent-derived curbs with a resolved parent ribbon', () => {
    const curb = makeObject({
      parentRibbonId: 'ribbon',
      parentSide: 'left',
      derivedWidth: 0.8,
      tRange: [0.2, 0.3],
    })
    const parent = makeObject({
      id: 'ribbon',
      type: 'track_ribbon',
      ribbonPoints: [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0, isPitLane: false },
      ],
    })

    expect(shouldRenderRibbonCurbSegment(curb, parent)).toBe(true)
  })

  test('renders explicit curb centerlines without a parent ribbon', () => {
    const curb = makeObject({
      curbCenterline: [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0, isPitLane: false },
      ],
    })

    expect(shouldRenderRibbonCurbSegment(curb)).toBe(true)
  })

  test('skips parent-derived curbs until the parent ribbon is resolved', () => {
    const curb = makeObject({ parentRibbonId: 'ribbon', tRange: [0.2, 0.3] })

    expect(shouldRenderRibbonCurbSegment(curb)).toBe(false)
  })

  test('falls back to explicit centerline when parent ribbon is unusable', () => {
    const curb = makeObject({
      parentRibbonId: 'bad-parent',
      curbCenterline: [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0, isPitLane: false },
      ],
    })
    const parent = makeObject({ id: 'bad-parent', type: 'painted_area' })

    expect(shouldRenderRibbonCurbSegment(curb, parent)).toBe(true)
  })

  test('skips parent-derived curbs when resolved parent has no ribbon points', () => {
    const curb = makeObject({ parentRibbonId: 'bad-parent', tRange: [0.2, 0.3] })
    const parent = makeObject({ id: 'bad-parent', type: 'track_ribbon', ribbonPoints: [] })

    expect(shouldRenderRibbonCurbSegment(curb, parent)).toBe(false)
  })
})
