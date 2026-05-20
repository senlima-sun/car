import { describe, expect, it } from 'bun:test'
import {
  getTerrainLookaheadDistance,
  resolveAirborneVerticalCorrection,
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
  it('terrain wins when within the suspension envelope (even if rapier is also inside)', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.2, 1.4)).toBe(1.2)
  })

  it('terrain wins when rapier misses and terrain is inside the envelope', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.4, null)).toBe(1.4)
  })

  it('terrain wins when rapier hit is outside the envelope but terrain is inside', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.4, 0.6)).toBe(1.4)
  })

  it('terrain wins when within ray length even if not within envelope and rapier is also outside', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 0.2, 0.8)).toBe(0.2)
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
