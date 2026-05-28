import { describe, expect, test } from 'vitest'
import { getEntitlements, type FeatureMatrix } from '../src/entitlements/features.ts'

const ALL_PERMISSIVE: FeatureMatrix = {
  raceMode: 'unlimited',
  timeTrial: true,
  ghost: true,
  editor: true,
  trackPreview: true,
  showroomBasic: true,
  showroomFull: true,
  telemetryExport: true,
  cloudLeaderboardRead: true,
  cloudLeaderboardWrite: true,
}

const FREE: FeatureMatrix = {
  raceMode: 'daily-only',
  timeTrial: false,
  ghost: false,
  editor: false,
  trackPreview: true,
  showroomBasic: true,
  showroomFull: false,
  telemetryExport: false,
  cloudLeaderboardRead: true,
  cloudLeaderboardWrite: false,
}

describe('getEntitlements', () => {
  test('admin + null tier → all permissive', () => {
    expect(getEntitlements({ role: 'admin', tier: null })).toEqual(ALL_PERMISSIVE)
  })

  test('admin + pro tier → all permissive', () => {
    expect(getEntitlements({ role: 'admin', tier: 'pro' })).toEqual(ALL_PERMISSIVE)
  })

  test('user + pro tier → all permissive', () => {
    expect(getEntitlements({ role: 'user', tier: 'pro' })).toEqual(ALL_PERMISSIVE)
  })

  test('user + null tier → free matrix', () => {
    expect(getEntitlements({ role: 'user', tier: null })).toEqual(FREE)
  })

  test('admin precedence holds regardless of tier', () => {
    expect(getEntitlements({ role: 'admin', tier: null })).toEqual(
      getEntitlements({ role: 'admin', tier: 'pro' }),
    )
  })

  test('free user is daily-only with read-only leaderboard', () => {
    const free = getEntitlements({ role: 'user', tier: null })
    expect(free.raceMode).toBe('daily-only')
    expect(free.cloudLeaderboardRead).toBe(true)
    expect(free.cloudLeaderboardWrite).toBe(false)
  })
})
