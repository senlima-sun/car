import { useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import {
  handleSteeringMouseMove,
  setSteeringHold,
  setSteeringLocked,
} from '@/input/mouseSteeringState'
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
      const steeringEnabled = useGameStore.getState().mouseSteeringEnabled
      setSteeringLocked(locked && steeringEnabled)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) setSteeringHold(true)
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) setSteeringHold(false)
    }

    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', handleSteeringMouseMove)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', handleSteeringMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [canvas])

  return { requestLock, exitLock }
}
