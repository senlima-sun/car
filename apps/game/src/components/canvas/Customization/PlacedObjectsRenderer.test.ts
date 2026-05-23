import { describe, expect, test } from 'vitest'
import { isAlwaysVisibleTrackObject } from './PlacedObjectsRenderer'

describe('isAlwaysVisibleTrackObject', () => {
  test('keeps track surface layers outside distance culling', () => {
    expect(isAlwaysVisibleTrackObject('track_ribbon')).toBe(true)
    expect(isAlwaysVisibleTrackObject('painted_area')).toBe(true)
    expect(isAlwaysVisibleTrackObject('edge_line')).toBe(true)
    expect(isAlwaysVisibleTrackObject('curb')).toBe(true)
  })

  test('keeps non-track-surface objects distance culled', () => {
    expect(isAlwaysVisibleTrackObject('cone')).toBe(false)
    expect(isAlwaysVisibleTrackObject('barrier')).toBe(false)
    expect(isAlwaysVisibleTrackObject('checkpoint')).toBe(false)
  })
})
