import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useCarStore } from '@/stores/useCarStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { interpolateGhostState } from '@/utils/ghostInterpolation'
import { createGhostTimeDeltaTracker } from '@/utils/ghostTimeDelta'
import { GhostCarBody } from './GhostCarBody'

export default function GhostCar() {
  const groupRef = useRef<THREE.Group>(null)
  const steerRef = useRef(0)
  const wheelsRef = useRef<[number, number, number, number]>([0, 0, 0, 0])
  const trackerRef = useRef(createGhostTimeDeltaTracker())
  const prevShouldShowRef = useRef(false)

  const replayData = useGhostCarStore(s => s.replayData)
  const loadReplayForTrack = useGhostCarStore(s => s.loadReplayForTrack)

  const isActive = useLapTimeStore(s => s.isActive)
  const isRecording = useLapTimeStore(s => s.isRecording)
  const lapCount = useLapTimeStore(s => s.lapCount)
  const currentLapStart = useLapTimeStore(s => s.currentLapStart)

  const activeTrackId = useTrackStore(s => s.trackLibrary.activeTrackId)

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

  const shouldShow =
    isActive && isRecording && lapCount >= 1 && replayData !== null && currentLapStart !== null

  useFrame(() => {
    const { setGhostFrameState } = useGhostCarStore.getState()

    if (!shouldShow && prevShouldShowRef.current) {
      trackerRef.current.reset()
      setGhostFrameState(null, null)
    }
    prevShouldShowRef.current = shouldShow

    if (!groupRef.current || !shouldShow) return
    const replay = useGhostCarStore.getState().replayData
    if (!replay) return
    const lapStart = useLapTimeStore.getState().currentLapStart
    if (lapStart === null) return
    const lapTime = performance.now() - lapStart
    const state = interpolateGhostState(replay, lapTime)
    if (!state) {
      groupRef.current.visible = false
      setGhostFrameState(null, null)
      return
    }
    groupRef.current.visible = true
    groupRef.current.position.copy(state.position)
    groupRef.current.quaternion.copy(state.quaternion)
    steerRef.current = state.steerAngle
    wheelsRef.current = state.wheelRotations

    const playerPos = useCarStore.getState().position
    const result = trackerRef.current.compute(replay, playerPos, lapTime)
    const ghostPos: [number, number, number] = [
      state.position.x,
      state.position.y,
      state.position.z,
    ]
    setGhostFrameState(ghostPos, result?.deltaMs ?? null)
  })

  if (!shouldShow) return null

  return (
    <group ref={groupRef} visible={false} renderOrder={100}>
      <GhostCarBody steerRef={steerRef} wheelsRef={wheelsRef} />
    </group>
  )
}
