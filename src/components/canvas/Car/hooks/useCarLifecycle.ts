import { useRef, useEffect, MutableRefObject } from 'react'
import { RapierRigidBody } from '@react-three/rapier'
import { useGameStore } from '../../../../stores/useGameStore'

interface CarLifecycleOptions {
  chassisRef: MutableRefObject<RapierRigidBody | null>
  startPosition: [number, number, number]
}

const SPAWN_PROTECT_FRAMES = 30

export function useCarLifecycle({ chassisRef, startPosition }: CarLifecycleOptions) {
  const gameStatus = useGameStore(state => state.status)
  const cameraMode = useGameStore(state => state.cameraMode)

  const spawnFrameRef = useRef(0)
  const prevGameStatusRef = useRef(gameStatus)
  const prevCameraModeRef = useRef(cameraMode)
  const tabResumeRef = useRef(false)

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        tabResumeRef.current = true
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const handleTabResume = () => {
    if (!tabResumeRef.current) return false
    tabResumeRef.current = false

    const chassis = chassisRef.current
    if (!chassis) return false

    const linvel = chassis.linvel()
    chassis.setLinvel({ x: linvel.x, y: Math.max(linvel.y, -2), z: linvel.z }, true)
    chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
    return true
  }

  const handleGameModeTransition = () => {
    const chassis = chassisRef.current
    if (!chassis) return

    if (prevGameStatusRef.current === 'customize' && gameStatus !== 'customize') {
      spawnFrameRef.current = 0
      chassis.setGravityScale(1, true)
      chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
      chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }
    prevGameStatusRef.current = gameStatus
  }

  const shouldPausePhysics = (): boolean => {
    const chassis = chassisRef.current
    if (!chassis) return true

    if (cameraMode === 'free' || gameStatus === 'customize') {
      chassis.setGravityScale(0, true)

      if (cameraMode === 'free' && prevCameraModeRef.current !== 'free') {
        chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }

      if (gameStatus === 'customize') {
        chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }

      prevCameraModeRef.current = cameraMode
      return true
    }

    if (prevCameraModeRef.current === 'free') {
      chassis.setGravityScale(1, true)
    }
    prevCameraModeRef.current = cameraMode

    return false
  }

  const handleSpawnProtection = (): boolean => {
    const chassis = chassisRef.current
    if (!chassis) return false

    if (spawnFrameRef.current < SPAWN_PROTECT_FRAMES) {
      spawnFrameRef.current++
      const p = chassis.translation()
      const minY = startPosition[1]

      if (p.y < minY) {
        chassis.setTranslation({ x: p.x, y: minY, z: p.z }, true)
        chassis.setLinvel({ x: 0, y: 0, z: 0 }, true)
        chassis.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }

      return spawnFrameRef.current < SPAWN_PROTECT_FRAMES
    }

    return false
  }

  return {
    handleTabResume,
    handleGameModeTransition,
    shouldPausePhysics,
    handleSpawnProtection,
  }
}
