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
  it('keeps a rapier hit that is already inside the suspension envelope', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.2, 1.4)).toBe(1.4)
  })

  it('uses terrain when rapier misses but the height is under the ray and inside the envelope', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.4, null)).toBe(1.4)
  })

  it('uses terrain when the rapier hit is outside the envelope but terrain is close enough', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 1.4, 0.6)).toBe(1.4)
  })

  it('keeps the rapier hit when terrain is lower', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 0.2, 0.8)).toBe(0.8)
  })

  it('ignores terrain outside the ray length', () => {
    expect(resolveTerrainSupportHitY(2, -1, 0.5, 0.8, 1, null)).toBeNull()
  })

  it('keeps a far rapier hit when terrain is also outside the suspension envelope', () => {
    expect(resolveTerrainSupportHitY(2, -1, 50, 0.8, 0.9, 0.6)).toBe(0.6)
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
