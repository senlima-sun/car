import { describe, expect, it } from 'bun:test'
import { getStableTrackLimitsOffTrack, isTrackLimitsOffTrack } from './TrackLimitsIndicator'

describe('isTrackLimitsOffTrack', () => {
  it('flags off-track when grounded on grass with no road contacts', () => {
    expect(
      isTrackLimitsOffTrack({
        speedKmh: 12,
        currentSurface: 'grass',
        roadContactCount: 0,
        curbContactCount: 0,
        pitroadContactCount: 0,
        groundedCount: 2,
      }),
    ).toBe(true)
  })

  it('does not flag off-track while airborne', () => {
    expect(
      isTrackLimitsOffTrack({
        speedKmh: 12,
        currentSurface: 'grass',
        roadContactCount: 0,
        curbContactCount: 0,
        pitroadContactCount: 0,
        groundedCount: 0,
      }),
    ).toBe(false)
  })

  it('does not flag off-track with only one grounded wheel', () => {
    expect(
      isTrackLimitsOffTrack({
        speedKmh: 12,
        currentSurface: 'grass',
        roadContactCount: 0,
        curbContactCount: 0,
        pitroadContactCount: 0,
        groundedCount: 1,
      }),
    ).toBe(false)
  })

  it('does not flag off-track when road contact remains', () => {
    expect(
      isTrackLimitsOffTrack({
        speedKmh: 12,
        currentSurface: 'grass',
        roadContactCount: 1,
        curbContactCount: 0,
        pitroadContactCount: 0,
        groundedCount: 2,
      }),
    ).toBe(false)
  })

  it('does not flag off-track while effectively stationary', () => {
    expect(
      isTrackLimitsOffTrack({
        speedKmh: 0.8,
        currentSurface: 'grass',
        roadContactCount: 0,
        curbContactCount: 0,
        pitroadContactCount: 0,
        groundedCount: 4,
      }),
    ).toBe(false)
  })
})

describe('getStableTrackLimitsOffTrack', () => {
  it('ignores short off-track flicker', () => {
    expect(getStableTrackLimitsOffTrack(true, 3, 4)).toBe(false)
  })

  it('accepts sustained off-track state', () => {
    expect(getStableTrackLimitsOffTrack(true, 4, 4)).toBe(true)
  })

  it('clears immediately when current state is back on track', () => {
    expect(getStableTrackLimitsOffTrack(false, 8, 4)).toBe(false)
  })
})
