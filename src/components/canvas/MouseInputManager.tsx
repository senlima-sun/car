import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { usePointerLock } from '@/hooks/usePointerLock'
import { useGameStore } from '@/stores/useGameStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { resetLookState } from '@/input/cameraLookState'

export default function MouseInputManager() {
  const { requestLock, exitLock } = usePointerLock()
  const gl = useThree(s => s.gl)
  const canvas = gl.domElement
  const lockDelayRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const isSettingsOpen = useGameStore(s => s.isSettingsOpen)
  const shellStatus = useGameStore(s => s.status)
  const cameraMode = useGameStore(s => s.cameraMode)
  const mouseSteeringEnabled = useGameStore(s => s.mouseSteeringEnabled)
  const sessionPhase = useSessionStore(s => s.phase)

  const baseGate = shellStatus === 'session' && sessionPhase === 'running' && !isSettingsOpen
  const shouldLockForLook = baseGate && cameraMode === 'first-person'
  const shouldLockForSteering = baseGate && mouseSteeringEnabled && cameraMode !== 'free'
  const shouldLock = shouldLockForLook || shouldLockForSteering

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
