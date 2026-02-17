import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { usePointerLock } from '@/hooks/usePointerLock'
import { useGameStore } from '@/stores/useGameStore'
import { resetLookState, setLookSensitivity } from '@/input/cameraLookState'

export default function MouseInputManager() {
  const { requestLock, exitLock } = usePointerLock()
  const gl = useThree(s => s.gl)
  const canvas = gl.domElement
  const lockDelayRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const isSettingsOpen = useGameStore(s => s.isSettingsOpen)
  const status = useGameStore(s => s.status)
  const cameraMode = useGameStore(s => s.cameraMode)
  const lookSensitivity = useGameStore(s => s.lookSensitivity)

  useEffect(() => {
    setLookSensitivity(lookSensitivity)
  }, [lookSensitivity])

  const shouldLock =
    status === 'racing' && cameraMode === 'first-person' && !isSettingsOpen

  useEffect(() => {
    clearTimeout(lockDelayRef.current)
    if (shouldLock) {
      lockDelayRef.current = setTimeout(requestLock, 100)
    } else {
      exitLock()
      resetLookState()
    }
    return () => clearTimeout(lockDelayRef.current)
  }, [shouldLock, requestLock, exitLock])

  useEffect(() => {
    const onClick = () => {
      if (shouldLock && document.pointerLockElement !== canvas) {
        requestLock()
      }
    }

    canvas.addEventListener('click', onClick)
    return () => canvas.removeEventListener('click', onClick)
  }, [shouldLock, canvas, requestLock])

  return null
}
