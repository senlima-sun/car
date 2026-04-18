import { useEffect, useRef } from 'react'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { isSessionShellStatus, useGameStore } from '@/stores/useGameStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { usePitStore } from '@/stores/usePitStore'
import {
  isRunningSessionPhase,
  isSetupSessionPhase,
  useSessionStore,
} from '@/stores/useSessionStore'

export default function SessionRuntimeController() {
  const shellStatus = useGameStore(s => s.status)
  const phase = useSessionStore(s => s.phase)
  const config = useSessionStore(s => s.config)
  const finishSession = useSessionStore(s => s.finishSession)
  const lapCount = useLapTimeStore(s => s.lapCount)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const prevPhaseRef = useRef(phase)
  const prevShellStatusRef = useRef(shellStatus)

  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    const prevShellStatus = prevShellStatusRef.current

    if (!isSessionShellStatus(shellStatus)) {
      if (isSessionShellStatus(prevShellStatus)) {
        useLapTimeStore.getState().reset()
        usePitStore.getState().clearPitLane()
      }
      prevPhaseRef.current = phase
      prevShellStatusRef.current = shellStatus
      return
    }

    if (isSetupSessionPhase(phase) && !isSetupSessionPhase(prevPhase)) {
      useLapTimeStore.getState().reset()
      usePitStore.getState().clearPitLane()
    }

    if (isRunningSessionPhase(phase) && !isRunningSessionPhase(prevPhase)) {
      const sectorCheckpointCount = placedObjects.filter(
        object => object.type === 'checkpoint' && object.checkpointType === 'sector',
      ).length
      useLapTimeStore.getState().reset()
      useLapTimeStore.getState().setActive(true, sectorCheckpointCount)
      if (!useLapTimeStore.getState().isRecording) {
        useLapTimeStore.getState().toggleRecording()
      }
    }

    prevPhaseRef.current = phase
    prevShellStatusRef.current = shellStatus
  }, [placedObjects, phase, shellStatus])

  useEffect(() => {
    if (!isSessionShellStatus(shellStatus) || !isRunningSessionPhase(phase) || !config?.lapLimit)
      return
    if (lapCount < config.lapLimit || lapCount <= 0) return
    finishSession()
  }, [config?.lapLimit, finishSession, lapCount, phase, shellStatus])

  return null
}
