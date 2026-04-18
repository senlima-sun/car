import { describe, expect, test, beforeEach } from 'bun:test'
import { useLeaderboardStore } from './useLeaderboardStore'

describe('useLeaderboardStore', () => {
  beforeEach(() => {
    useLeaderboardStore.getState().clearAll()
  })

  test('addEntry + topForTrack sorts by lap time', () => {
    useLeaderboardStore.getState().addEntry({
      trackId: 'silverstone',
      driverName: 'A',
      lapTimeMs: 90000,
      setupId: null,
      valid: true,
      source: 'personal',
    })
    useLeaderboardStore.getState().addEntry({
      trackId: 'silverstone',
      driverName: 'B',
      lapTimeMs: 85000,
      setupId: null,
      valid: true,
      source: 'personal',
    })
    const top = useLeaderboardStore.getState().topForTrack('silverstone')
    expect(top[0].driverName).toBe('B')
    expect(top[1].driverName).toBe('A')
  })

  test('filters invalid laps', () => {
    useLeaderboardStore.getState().addEntry({
      trackId: 'silverstone',
      driverName: 'A',
      lapTimeMs: 80000,
      setupId: null,
      valid: false,
      source: 'personal',
    })
    const top = useLeaderboardStore.getState().topForTrack('silverstone')
    expect(top.length).toBe(0)
  })

  test('clearTrack removes only that track', () => {
    useLeaderboardStore.getState().addEntry({
      trackId: 'silverstone',
      driverName: 'A',
      lapTimeMs: 80000,
      setupId: null,
      valid: true,
      source: 'personal',
    })
    useLeaderboardStore.getState().addEntry({
      trackId: 'monza',
      driverName: 'B',
      lapTimeMs: 80000,
      setupId: null,
      valid: true,
      source: 'personal',
    })
    useLeaderboardStore.getState().clearTrack('silverstone')
    expect(useLeaderboardStore.getState().entries.length).toBe(1)
    expect(useLeaderboardStore.getState().entries[0].trackId).toBe('monza')
  })
})
