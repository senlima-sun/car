import { useEffect, useRef } from 'react'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { usePitStore } from '@/stores/usePitStore'
import {
  isPausedSessionPhase,
  isRunningSessionPhase,
  useSessionStore,
} from '@/stores/useSessionStore'
import { useTrackLimitsStore } from '@/stores/useTrackLimitsStore'
import { resetErsLap, isPhysicsEngineInitialized } from '@/wasm'

export default function SessionEventBridge() {
  const phase = useSessionStore(s => s.phase)
  const recordEvent = useSessionStore(s => s.recordEvent)

  const lapCount = useLapTimeStore(s => s.lapCount)
  const lastLapTime = useLapTimeStore(s => s.lastLapTime)
  const bestLapTime = useLapTimeStore(s => s.bestLapTime)
  const currentLapStart = useLapTimeStore(s => s.currentLapStart)
  const currentLapInvalid = useLapTimeStore(s => s.currentLapInvalid)
  const lastSectorSplit = useLapTimeStore(s => s.lastSectorSplit)

  const isInPitLane = usePitStore(s => s.isInPitLane)
  const isPitStopActive = usePitStore(s => s.isPitStopActive)
  const pitLaneSpeedingPenalty = usePitStore(s => s.pitLaneSpeedingPenalty)

  const violationCount = useTrackLimitsStore(s => s.violationCount)
  const totalViolationTime = useTrackLimitsStore(s => s.totalViolationTime)

  const prevPhaseRef = useRef(phase)
  const prevLapCountRef = useRef(lapCount)
  const prevLapStartRef = useRef(currentLapStart)
  const prevLapInvalidRef = useRef(currentLapInvalid)
  const prevSectorRef = useRef<string | null>(null)
  const prevPitLaneRef = useRef(isInPitLane)
  const prevPitStopRef = useRef(isPitStopActive)
  const prevPenaltyRef = useRef(pitLaneSpeedingPenalty)
  const prevViolationRef = useRef(violationCount)

  useEffect(() => {
    const previousPhase = prevPhaseRef.current

    if (isRunningSessionPhase(phase) && !isRunningSessionPhase(previousPhase)) {
      recordEvent({ type: 'session_started', at: Date.now() })
    } else if (isPausedSessionPhase(phase) && isRunningSessionPhase(previousPhase)) {
      recordEvent({ type: 'session_paused', at: Date.now() })
    } else if (isRunningSessionPhase(phase) && isPausedSessionPhase(previousPhase)) {
      recordEvent({ type: 'session_resumed', at: Date.now() })
    }

    prevPhaseRef.current = phase
  }, [phase, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase)) {
      prevLapStartRef.current = currentLapStart
      return
    }

    if (currentLapStart !== null && prevLapStartRef.current === null) {
      recordEvent({ type: 'lap_started', at: Date.now(), lapNumber: lapCount + 1 })
    }

    prevLapStartRef.current = currentLapStart
  }, [currentLapStart, lapCount, phase, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase)) {
      prevLapCountRef.current = lapCount
      return
    }

    if (lapCount > prevLapCountRef.current) {
      recordEvent({
        type: 'lap_completed',
        at: Date.now(),
        lapNumber: lapCount,
        lapTime: lastLapTime,
        valid: lastLapTime !== null,
        isPersonalBest: lastLapTime !== null && bestLapTime !== null && lastLapTime === bestLapTime,
      })
      if (isPhysicsEngineInitialized()) {
        try {
          resetErsLap()
        } catch {
          // WASM not ready; ignore
        }
      }
    }

    prevLapCountRef.current = lapCount
  }, [bestLapTime, lapCount, lastLapTime, phase, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase)) {
      prevLapInvalidRef.current = currentLapInvalid
      return
    }

    if (currentLapInvalid && !prevLapInvalidRef.current) {
      recordEvent({ type: 'lap_invalidated', at: Date.now(), reason: 'wrong-way' })
    }

    prevLapInvalidRef.current = currentLapInvalid
  }, [currentLapInvalid, phase, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase) || !lastSectorSplit) return

    const sectorKey = `${lastSectorSplit.sectorNumber}:${lastSectorSplit.time}:${lastSectorSplit.delta ?? ''}`
    if (sectorKey === prevSectorRef.current) return

    recordEvent({
      type: 'sector_completed',
      at: Date.now(),
      sectorNumber: lastSectorSplit.sectorNumber,
      sectorTime: lastSectorSplit.time,
      delta: lastSectorSplit.delta,
    })

    prevSectorRef.current = sectorKey
  }, [lastSectorSplit, phase, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase)) {
      prevPitLaneRef.current = isInPitLane
      return
    }

    if (isInPitLane && !prevPitLaneRef.current) {
      recordEvent({ type: 'pit_lane_entered', at: Date.now() })
    } else if (!isInPitLane && prevPitLaneRef.current) {
      recordEvent({ type: 'pit_lane_exited', at: Date.now() })
    }

    prevPitLaneRef.current = isInPitLane
  }, [isInPitLane, phase, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase)) {
      prevPitStopRef.current = isPitStopActive
      return
    }

    if (isPitStopActive && !prevPitStopRef.current) {
      recordEvent({ type: 'pit_stop_started', at: Date.now() })
    } else if (!isPitStopActive && prevPitStopRef.current) {
      recordEvent({ type: 'pit_stop_ended', at: Date.now() })
    }

    prevPitStopRef.current = isPitStopActive
  }, [isPitStopActive, phase, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase)) {
      prevPenaltyRef.current = pitLaneSpeedingPenalty
      return
    }

    if (pitLaneSpeedingPenalty > prevPenaltyRef.current) {
      recordEvent({
        type: 'pit_penalty_applied',
        at: Date.now(),
        penaltySeconds: pitLaneSpeedingPenalty - prevPenaltyRef.current,
        totalPenaltySeconds: pitLaneSpeedingPenalty,
      })
    }

    prevPenaltyRef.current = pitLaneSpeedingPenalty
  }, [phase, pitLaneSpeedingPenalty, recordEvent])

  useEffect(() => {
    if (!isRunningSessionPhase(phase)) {
      prevViolationRef.current = violationCount
      return
    }

    if (violationCount > prevViolationRef.current) {
      recordEvent({
        type: 'track_limits_violation',
        at: Date.now(),
        violationCount,
        totalViolationTime,
      })
    }

    prevViolationRef.current = violationCount
  }, [phase, recordEvent, totalViolationTime, violationCount])

  return null
}
