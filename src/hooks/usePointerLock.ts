import { useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import {
  setPointerLocked,
  resetLookState,
  handleLookMouseMove,
} from '@/input/cameraLookState'

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
      if (!locked) resetLookState()
    }

    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('mousemove', handleLookMouseMove)

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('mousemove', handleLookMouseMove)
    }
  }, [canvas])

  return { requestLock, exitLock }
}
