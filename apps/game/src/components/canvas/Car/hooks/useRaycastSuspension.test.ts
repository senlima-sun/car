import { describe, expect, it } from 'vitest'
import {
  getTerrainLookaheadDistance,
  resolveAirborneVerticalCorrection,
  resolveSuspensionVisualDeflection,
  resolveTerrainSupportHitY,
} from './useRaycastSuspension'

describe('getTerrainLookaheadDistance', () => {
  it('returns zero at very low speed', () => {
    expect(getTerrainLookaheadDistance(0.8)).toBe(0)
  })

  it('grows with speed and clamps to the configured maximum', () => {
    expect(getTerrainLookaheadDistance(10)).toBeCloseTo(0.55, 5)
    expect(getTerrainLookaheadDistance(80)).toBe(1.1)
  })
})

describe('resolveTerrainSupportHitY', () => {
  it('uses the closest support hit when terrain and rapier are both in the suspension envelope', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.2, 1.4)).toBe(1.4)
  })

  it('uses a raised rapier curb instead of lower terrain', () => {
    expect(resolveTerrainSupportHitY(1.2, -1, 50, 1.0, 0, 0.08)).toBe(0.08)
  })

  it('terrain wins when rapier misses and terrain is inside the envelope', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.4, null)).toBe(1.4)
  })

  it('terrain wins when rapier hit is outside the envelope but terrain is inside', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.4, 0.6)).toBe(1.4)
  })

  it('terrain wins when within ray length even if not within envelope and rapier is also outside', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 0.2, 0.8)).toBe(0.8)
  })

  it('rapier wins when inside envelope and terrain is outside the envelope', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 0.9, 1.4)).toBe(1.4)
  })

  it('ignores terrain outside the ray length and returns null when rapier also misses', () => {
    expect(resolveTerrainSupportHitY(2, -1, 0.5, 0.8, 1, null)).toBeNull()
  })

  it('handles a stale ribbon mesh at y=0 by preferring the high terrain inside envelope', () => {
    expect(resolveTerrainSupportHitY(50.8, -1, 60, 1.0, 50, 0)).toBe(50)
  })
})

describe('resolveSuspensionVisualDeflection', () => {
  it('normal static compression has no visual offset', () => {
    expect(resolveSuspensionVisualDeflection(1 / 7)).toBeCloseTo(0, 5)
  })

  it('moves upward from extra compression', () => {
    expect(resolveSuspensionVisualDeflection(1 / 7 + 0.03)).toBeCloseTo(0.03, 5)
  })

  it('limits rebound droop', () => {
    expect(resolveSuspensionVisualDeflection(0)).toBeCloseTo(-0.05, 5)
  })
})

describe('resolveAirborneVerticalCorrection', () => {
  it('does not lift from stale ground while moving upward', () => {
    expect(
      resolveAirborneVerticalCorrection({
        currentGroundY: 1,
        wheelBottomY: 0.8,
        maxBodyPenetration: 0,
        verticalVelocity: 0.5,
      }),
    ).toBe(0)
  })

  it('limits stale ground correction during a short ray miss', () => {
    expect(
      resolveAirborneVerticalCorrection({
        currentGroundY: 1,
        wheelBottomY: 0.8,
        maxBodyPenetration: 0,
        verticalVelocity: -0.5,
        maxStaleGroundCorrection: 0.015,
      }),
    ).toBe(0.015)
  })

  it('keeps body penetration correction authoritative', () => {
    expect(
      resolveAirborneVerticalCorrection({
        currentGroundY: 1,
        wheelBottomY: 0.99,
        maxBodyPenetration: 0.12,
        verticalVelocity: -0.5,
      }),
    ).toBe(0.12)
  })
})
