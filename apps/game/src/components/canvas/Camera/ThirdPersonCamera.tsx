import { useRef } from 'react'
import { Vector3, Quaternion, Euler, PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useCarStore } from '../../../stores/useCarStore'
import { useGhostPreferenceStore } from '../../../stores/useGhostPreferenceStore'
import { useAiGhostStore } from '../../../stores/useAiGhostStore'
import {
  CAMERA_NEAR,
  CAMERA_FAR,
  FLIP_ROTATION,
  SURFACE_SHAKE_INTENSITY,
  SURFACE_SHAKE_ROTATION,
  SURFACE_SHAKE_FREQ,
} from './constants'
import { extractYawQuaternion, slerpOrSnap } from './utils'
import type { CameraTargetProps } from './types'

const ROTATION_LERP = 0.25
const CHASE_OFFSET = new Vector3(0, 1.85, 2)

export default function ThirdPersonCamera({ target }: CameraTargetProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const _quat = useRef(new Quaternion())
  const _yawQuat = useRef(new Quaternion())
  const _pos = useRef(new Vector3())
  const _worldPos = useRef(new Vector3())
  const _targetQuat = useRef(new Quaternion())
  const initialized = useRef(false)
  const shakePhase = useRef(0)
  const _shakeEuler = useRef(new Euler())
  const _shakeQuat = useRef(new Quaternion())

  useFrame((_state, delta) => {
    if (!cameraRef.current) return

    const spectatorMode = useGhostPreferenceStore.getState().spectatorMode
    const ghostPos = useAiGhostStore.getState().ghostPosition

    if (spectatorMode && ghostPos !== null) {
      _worldPos.current.set(ghostPos[0], ghostPos[1], ghostPos[2])
      _yawQuat.current.identity()
    } else {
      if (!target.current) return
      target.current.getWorldQuaternion(_quat.current)
      target.current.getWorldPosition(_worldPos.current)
      extractYawQuaternion(_quat.current, _yawQuat.current)
    }

    _pos.current.copy(CHASE_OFFSET)
    _pos.current.applyQuaternion(_yawQuat.current)
    _pos.current.add(_worldPos.current)

    const surface = useSurfaceStore.getState().currentSurface
    const speed = useCarStore.getState().speed
    const baseIntensity = spectatorMode ? 0 : (SURFACE_SHAKE_INTENSITY[surface] ?? 0)
    const baseRotation = spectatorMode ? 0 : (SURFACE_SHAKE_ROTATION[surface] ?? 0)
    const freqMult = SURFACE_SHAKE_FREQ[surface] ?? 1.0

    if (baseIntensity > 0 && speed > 5) {
      const speedFactor = Math.min(speed / 120, 1.0)
      const intensity = baseIntensity * speedFactor
      const rotIntensity = baseRotation * speedFactor
      shakePhase.current += delta * (30 + speed * 0.4) * freqMult
      const phase = shakePhase.current

      const bump1 = Math.sin(phase * 7.3)
      const bump2 = Math.sin(phase * 13.1) * 0.5
      const bump3 = Math.sin(phase * 23.7) * 0.25
      const combined = bump1 + bump2 + bump3

      _pos.current.x += combined * intensity * 0.8
      _pos.current.y += (Math.sin(phase * 11.7) + Math.sin(phase * 19.3) * 0.4) * intensity
      _pos.current.z += (Math.sin(phase * 5.1) + Math.sin(phase * 17.9) * 0.3) * intensity * 0.6

      _shakeEuler.current.set(
        Math.sin(phase * 9.1) * rotIntensity,
        Math.sin(phase * 6.7) * rotIntensity * 0.3,
        (Math.sin(phase * 14.3) + Math.sin(phase * 21.1) * 0.5) * rotIntensity * 0.7,
      )
      _shakeQuat.current.setFromEuler(_shakeEuler.current)
    } else {
      _shakeQuat.current.identity()
    }

    _targetQuat.current.copy(_yawQuat.current).multiply(FLIP_ROTATION).multiply(_shakeQuat.current)

    slerpOrSnap(cameraRef.current, _targetQuat.current, ROTATION_LERP, initialized)
    cameraRef.current.position.copy(_pos.current)
  })

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault fov={85} near={CAMERA_NEAR} far={CAMERA_FAR} />
  )
}
