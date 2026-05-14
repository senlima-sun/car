import type { SessionEventInput } from '@/types/sessionEvents'
import type { SessionPhase } from '@/types/session'

export interface SessionSnapshot {
  phase: SessionPhase
  lapCount: number
  lastLapTime: number | null
  bestLapTime: number | null
  currentLapStart: number | null
  currentLapInvalid: boolean
  lastSectorSplitKey: string | null
  isInPitLane: boolean
  isPitStopActive: boolean
  pitLaneSpeedingPenalty: number
  violationCount: number
  totalViolationTime: number
}

export interface SectorSplitData {
  sectorNumber: number
  time: number
  delta: number | null
}

const isRunning = (phase: SessionPhase) => phase === 'running'
const isPaused = (phase: SessionPhase) => phase === 'paused'

export function sectorSplitKey(split: SectorSplitData | null): string | null {
  if (!split) return null
  return `${split.sectorNumber}:${split.time}:${split.delta ?? ''}`
}

export function deriveSessionEvents(
  prev: SessionSnapshot,
  next: SessionSnapshot,
  now: number,
  lastSectorSplit: SectorSplitData | null,
): SessionEventInput[] {
  const out: SessionEventInput[] = []

  if (isRunning(next.phase) && !isRunning(prev.phase)) {
    out.push({ type: 'session_started', at: now })
  } else if (isPaused(next.phase) && isRunning(prev.phase)) {
    out.push({ type: 'session_paused', at: now })
  } else if (isRunning(next.phase) && isPaused(prev.phase)) {
    out.push({ type: 'session_resumed', at: now })
  }

  if (!isRunning(next.phase)) return out

  if (next.currentLapStart !== null && prev.currentLapStart === null) {
    out.push({ type: 'lap_started', at: now, lapNumber: next.lapCount + 1 })
  }

  if (next.lapCount > prev.lapCount) {
    out.push({
      type: 'lap_completed',
      at: now,
      lapNumber: next.lapCount,
      lapTime: next.lastLapTime,
      valid: next.lastLapTime !== null,
      isPersonalBest:
        next.lastLapTime !== null && next.bestLapTime !== null && next.lastLapTime === next.bestLapTime,
    })
  }

  if (next.currentLapInvalid && !prev.currentLapInvalid) {
    out.push({ type: 'lap_invalidated', at: now, reason: 'wrong-way' })
  }

  if (lastSectorSplit && next.lastSectorSplitKey !== prev.lastSectorSplitKey) {
    out.push({
      type: 'sector_completed',
      at: now,
      sectorNumber: lastSectorSplit.sectorNumber,
      sectorTime: lastSectorSplit.time,
      delta: lastSectorSplit.delta,
    })
  }

  if (next.isInPitLane && !prev.isInPitLane) {
    out.push({ type: 'pit_lane_entered', at: now })
  } else if (!next.isInPitLane && prev.isInPitLane) {
    out.push({ type: 'pit_lane_exited', at: now })
  }

  if (next.isPitStopActive && !prev.isPitStopActive) {
    out.push({ type: 'pit_stop_started', at: now })
  } else if (!next.isPitStopActive && prev.isPitStopActive) {
    out.push({ type: 'pit_stop_ended', at: now })
  }

  if (next.pitLaneSpeedingPenalty > prev.pitLaneSpeedingPenalty) {
    out.push({
      type: 'pit_penalty_applied',
      at: now,
      penaltySeconds: next.pitLaneSpeedingPenalty - prev.pitLaneSpeedingPenalty,
      totalPenaltySeconds: next.pitLaneSpeedingPenalty,
    })
  }

  if (next.violationCount > prev.violationCount) {
    out.push({
      type: 'track_limits_violation',
      at: now,
      violationCount: next.violationCount,
      totalViolationTime: next.totalViolationTime,
    })
  }

  return out
}
