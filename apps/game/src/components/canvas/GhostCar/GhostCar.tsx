import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useAiGhostStore } from '@/stores/useAiGhostStore'
import { useGhostPreferenceStore } from '@/stores/useGhostPreferenceStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useCarStore } from '@/stores/useCarStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { interpolateGhostState } from '@/utils/ghostInterpolation'
import { createGhostTimeDeltaTracker } from '@/utils/ghostTimeDelta'
import { GhostCarBody } from './GhostCarBody'

const SPECTATOR_LOOP_PAD_MS = 500

export default function GhostCar() {
  const groupRef = useRef<THREE.Group>(null)
  const steerRef = useRef(0)
  const wheelsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const trackerRef = useRef(createGhostTimeDeltaTracker())
  const prevShouldShowRef = useRef(false)

  const humanReplay = useGhostCarStore(s => s.replayData)
  const loadReplayForTrack = useGhostCarStore(s => s.loadReplayForTrack)
  const aiReplay = useAiGhostStore(s => s.replayData)
  const preferAiGhost = useGhostPreferenceStore(s => s.preferAiGhost)
  const spectatorMode = useGhostPreferenceStore(s => s.spectatorMode)

  const isActive = useLapTimeStore(s => s.isActive)
  const isRecording = useLapTimeStore(s => s.isRecording)
  const lapCount = useLapTimeStore(s => s.lapCount)
  const currentLapStart = useLapTimeStore(s => s.currentLapStart)

  const activeTrackId = useTrackStore(s => s.trackLibrary.activeTrackId)

  const useAiReplay = (preferAiGhost || spectatorMode) && aiReplay !== null
  const activeReplay = useAiReplay ? aiReplay : humanReplay

  useEffect(() => {
    if (activeTrackId) {
      loadReplayForTrack(activeTrackId)
    } else {
      useGhostCarStore.getState().clearReplay()
    }
  }, [activeTrackId, loadReplayForTrack])

  useEffect(() => {
    trackerRef.current.reset()
  }, [lapCount])

  const shouldShow = spectatorMode
    ? activeReplay !== null
    : isActive && isRecording && lapCount >= 1 && activeReplay !== null && currentLapStart !== null

  useFrame(() => {
    const { setGhostFrameState } = useGhostCarStore.getState()

    if (!shouldShow && prevShouldShowRef.current) {
      trackerRef.current.reset()
      setGhostFrameState(null, null)
      useAiGhostStore.getState().setGhostFrameState(null, null)
    }
    prevShouldShowRef.current = shouldShow

    if (!groupRef.current || !shouldShow) return
    const replay = useAiReplay
      ? useAiGhostStore.getState().replayData
      : useGhostCarStore.getState().replayData
    if (!replay) return

    let lapTime: number
    if (spectatorMode) {
      const prefs = useGhostPreferenceStore.getState()
      let lapStart = prefs.spectatorLapStart
      if (lapStart === null) {
        lapStart = performance.now()
        prefs.setSpectatorLapStart(lapStart)
      }
      lapTime = performance.now() - lapStart
      if (lapTime > replay.lapTime + SPECTATOR_LOOP_PAD_MS) {
        prefs.setSpectatorLapStart(performance.now())
        return
      }
    } else {
      const lapStart = useLapTimeStore.getState().currentLapStart
      if (lapStart === null) return
      lapTime = performance.now() - lapStart
    }

    const state = interpolateGhostState(replay, lapTime)
    if (!state) {
      groupRef.current.visible = false
      if (useAiReplay) {
        useAiGhostStore.getState().setGhostFrameState(null, null)
      } else {
        setGhostFrameState(null, null)
      }
      return
    }
    groupRef.current.visible = true
    groupRef.current.position.copy(state.position)
    groupRef.current.quaternion.copy(state.quaternion)
    steerRef.current = state.steerAngle
    wheelsRef.current = state.wheelRotations

    const ghostPos: [number, number, number] = [
      state.position.x,
      state.position.y,
      state.position.z,
    ]

    if (spectatorMode) {
      if (useAiReplay) {
        useAiGhostStore.getState().setGhostFrameState(ghostPos, null)
      } else {
        setGhostFrameState(ghostPos, null)
      }
      return
    }

    const playerPos = useCarStore.getState().position
    const result = trackerRef.current.compute(replay, playerPos, lapTime)
    if (useAiReplay) {
      useAiGhostStore.getState().setGhostFrameState(ghostPos, result?.deltaMs ?? null)
    } else {
      setGhostFrameState(ghostPos, result?.deltaMs ?? null)
    }
  })

  if (!shouldShow) return null

  return (
    <group ref={groupRef} visible={false} renderOrder={100}>
      <GhostCarBody steerRef={steerRef} wheelsRef={wheelsRef} />
    </group>
  )
}
