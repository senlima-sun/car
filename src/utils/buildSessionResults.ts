import type { SessionResultsSnapshot, SessionConfig } from '@/types/session'
import type { SessionEvent } from '@/types/sessionEvents'

interface LapSnapshot {
  lapCount: number
  bestLapTime: number | null
  lastLapTime: number | null
}

export function buildSessionResults(
  config: SessionConfig,
  lap: LapSnapshot,
  events: SessionEvent[],
  completedAt = Date.now(),
): SessionResultsSnapshot {
  let invalidLapCount = 0
  let pitLanePenaltySeconds = 0
  let trackLimitsViolations = 0
  let sectorEvents = 0

  for (const event of events) {
    if (event.type === 'lap_invalidated') {
      invalidLapCount += 1
    } else if (event.type === 'pit_penalty_applied') {
      pitLanePenaltySeconds = Math.max(pitLanePenaltySeconds, event.totalPenaltySeconds)
    } else if (event.type === 'track_limits_violation') {
      trackLimitsViolations = Math.max(trackLimitsViolations, event.violationCount)
    } else if (event.type === 'sector_completed') {
      sectorEvents += 1
    }
  }

  return {
    kind: config.kind,
    trackId: config.trackId,
    completedAt,
    lapCount: lap.lapCount,
    bestLapTime: lap.bestLapTime,
    lastLapTime: lap.lastLapTime,
    testingMode: config.testingMode,
    invalidLapCount,
    pitLanePenaltySeconds,
    trackLimitsViolations,
    sectorEvents,
    eventCount: events.length,
  }
}
