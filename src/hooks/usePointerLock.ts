import { useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { setPointerLocked, resetLookState, handleLookMouseMove } from '@/input/cameraLookState'
import { handleSteeringMouseMove, setSteeringLocked } from '@/input/mouseSteeringState'
import { useGameStore } from '@/stores/useGameStore'

export function usePointerLock() {
  const gl = useThree(s => s.gl)
  const canvas = gl.domElement

  const requestLock = useCallback(() => {
    if (document.pointerLockElement === canvas) return
    canvas.requestPointerLock().catch(() => {})
  }, [canvas])

  const exitLock = useCallback(() => {
    if (document.pointerLockElement !== canvas) return
    document.exitPointerLock()
  }, [canvas])

  useEffect(() => {
    const onLockChange = () => {
      const locked = document.pointerLockElement === canvas
      setPointerLocked(locked)
      const steeringEnabled = useGameStore.getState().mouseSteeringEnabled
      if (!locked || steeringEnabled) {
        setSteeringLocked(locked)
      }
      if (!locked) resetLookState()
    }

    const onMouseMove = (e: MouseEvent) => {
      handleLookMouseMove(e)
      handleSteeringMouseMove(e)
    }

    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', onMouseMove)

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [canvas])

  return { requestLock, exitLock }
}
