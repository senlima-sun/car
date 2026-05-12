import { describe, it, expect } from 'bun:test'
import {
  shouldAbortOffTrack,
  shouldAbortStuck,
  shouldAbortTimeout,
  isValidationLapComplete,
} from './validationDriveLogic'
import { MAX_OFF_TRACK_SECONDS, MAX_VALIDATION_DRIVE_SECONDS } from './ValidationDriveHud'

describe('shouldAbortOffTrack', () => {
  it('returns true when off-track seconds exceed threshold', () => {
    expect(shouldAbortOffTrack(11, MAX_OFF_TRACK_SECONDS)).toBe(true)
  })

  it('returns false when off-track seconds are just below threshold', () => {
    expect(shouldAbortOffTrack(9.99, MAX_OFF_TRACK_SECONDS)).toBe(false)
  })

  it('returns false when off-track seconds are zero', () => {
    expect(shouldAbortOffTrack(0, MAX_OFF_TRACK_SECONDS)).toBe(false)
  })
})

describe('shouldAbortStuck', () => {
  const FAR_FROM_GRID_SQ = 10000
  const GRID_RADIUS_SQ = 2500

  it('returns true when slow, stuck timer expired, and far from grid', () => {
    expect(shouldAbortStuck(3, 6, FAR_FROM_GRID_SQ, GRID_RADIUS_SQ)).toBe(true)
  })

  it('returns false when within grid radius — start-line carve-out', () => {
    expect(shouldAbortStuck(3, 6, 100, GRID_RADIUS_SQ)).toBe(false)
  })

  it('returns false when speed exceeds stuck threshold even with long timer', () => {
    expect(shouldAbortStuck(10, 10, FAR_FROM_GRID_SQ, GRID_RADIUS_SQ)).toBe(false)
  })

  it('returns false when stuck timer has not expired yet', () => {
    expect(shouldAbortStuck(2, 3, FAR_FROM_GRID_SQ, GRID_RADIUS_SQ)).toBe(false)
  })
})

describe('shouldAbortTimeout', () => {
  it('returns true when elapsed exceeds max seconds', () => {
    expect(shouldAbortTimeout(601_000, MAX_VALIDATION_DRIVE_SECONDS)).toBe(true)
  })

  it('returns false when elapsed is under max seconds', () => {
    expect(shouldAbortTimeout(599_000, MAX_VALIDATION_DRIVE_SECONDS)).toBe(false)
  })
})

describe('isValidationLapComplete', () => {
  it('returns true when lap started after validation started and lastLapTime is set', () => {
    expect(isValidationLapComplete(1000, 500, 95.4)).toBe(true)
  })

  it('returns false when lastLapTime is null', () => {
    expect(isValidationLapComplete(1000, 500, null)).toBe(false)
  })

  it('returns false when lap started before validation started', () => {
    expect(isValidationLapComplete(400, 500, 90)).toBe(false)
  })

  it.skip('dev-only window.__VALIDATION_DRIVE_START__ assignment is not testable — guarded by if (!IS_DEV) return', () => {
    expect(true).toBe(true)
  })
})
