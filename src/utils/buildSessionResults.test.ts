import { describe, expect, it } from 'bun:test'
import { createSessionConfig } from '@/types/session'
import type { SessionEvent } from '@/types/sessionEvents'
import { buildSessionResults } from './buildSessionResults'

describe('buildSessionResults', () => {
  it('aggregates penalties, invalidations, and sector activity from session events', () => {
    const config = createSessionConfig('race', { trackId: 'monza', testingMode: true })
    const events: SessionEvent[] = [
      { id: '1', type: 'session_started', at: 10 },
      { id: '2', type: 'sector_completed', at: 20, sectorNumber: 1, sectorTime: 30000, delta: null },
      { id: '3', type: 'track_limits_violation', at: 30, violationCount: 2, totalViolationTime: 800 },
      { id: '4', type: 'pit_penalty_applied', at: 40, penaltySeconds: 3, totalPenaltySeconds: 6 },
      { id: '5', type: 'lap_invalidated', at: 50, reason: 'wrong-way' },
    ]

    const result = buildSessionResults(
      config,
      {
        lapCount: 4,
        bestLapTime: 91234,
        lastLapTime: 93000,
      },
      events,
      123456,
    )

    expect(result.kind).toBe('race')
    expect(result.trackId).toBe('monza')
    expect(result.testingMode).toBe(true)
    expect(result.invalidLapCount).toBe(1)
    expect(result.pitLanePenaltySeconds).toBe(6)
    expect(result.trackLimitsViolations).toBe(2)
    expect(result.sectorEvents).toBe(1)
    expect(result.eventCount).toBe(5)
    expect(result.completedAt).toBe(123456)
  })
})
