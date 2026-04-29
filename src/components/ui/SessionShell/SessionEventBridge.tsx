import { useEffect } from 'react'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { usePitStore } from '@/stores/usePitStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { useTrackLimitsStore } from '@/stores/useTrackLimitsStore'
import { resetErsLap, isPhysicsEngineInitialized } from '@/wasm'
import { deriveSessionEvents, sectorSplitKey, type SessionSnapshot } from './sessionEvents'

function captureSnapshot(): SessionSnapshot {
  const session = useSessionStore.getState()
  const lap = useLapTimeStore.getState()
  const pit = usePitStore.getState()
  const limits = useTrackLimitsStore.getState()
  return {
    phase: session.phase,
    lapCount: lap.lapCount,
    lastLapTime: lap.lastLapTime,
    bestLapTime: lap.bestLapTime,
    currentLapStart: lap.currentLapStart,
    currentLapInvalid: lap.currentLapInvalid,
    lastSectorSplitKey: sectorSplitKey(lap.lastSectorSplit),
    isInPitLane: pit.isInPitLane,
    isPitStopActive: pit.isPitStopActive,
    pitLaneSpeedingPenalty: pit.pitLaneSpeedingPenalty,
    violationCount: limits.violationCount,
    totalViolationTime: limits.totalViolationTime,
  }
}

export default function SessionEventBridge() {
  useEffect(() => {
    let prev = captureSnapshot()

    const handle = () => {
      const next = captureSnapshot()
      const events = deriveSessionEvents(prev, next, Date.now(), useLapTimeStore.getState().lastSectorSplit)
      prev = next
      if (events.length === 0) return
      const recordEvent = useSessionStore.getState().recordEvent
      for (const event of events) {
        recordEvent(event)
        if (event.type === 'lap_completed' && isPhysicsEngineInitialized()) {
          try {
            resetErsLap()
          } catch {
            // WASM not ready; ignore
          }
        }
      }
    }

    const unsubSession = useSessionStore.subscribe(handle)
    const unsubLap = useLapTimeStore.subscribe(handle)
    const unsubPit = usePitStore.subscribe(handle)
    const unsubLimits = useTrackLimitsStore.subscribe(handle)

    return () => {
      unsubSession()
      unsubLap()
      unsubPit()
      unsubLimits()
    }
  }, [])

  return null
}
