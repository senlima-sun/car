import { useRef, RefObject } from 'react'
import {
  Vector3,
  Quaternion,
  Euler,
  PerspectiveCamera as ThreePerspectiveCamera,
  Group,
} from 'three'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useCarStore } from '../../../stores/useCarStore'

const SURFACE_SHAKE_INTENSITY: Record<string, number> = {
  road: 0,
  curb: 0.008,
  pitroad: 0,
  gravel: 0.035,
  grass: 0.022,
}

const SURFACE_SHAKE_ROTATION: Record<string, number> = {
  road: 0,
  curb: 0.002,
  pitroad: 0,
  gravel: 0.012,
  grass: 0.008,
}

const SURFACE_SHAKE_FREQ: Record<string, number> = {
  road: 0,
  curb: 1.0,
  pitroad: 0,
  gravel: 1.4,
  grass: 1.0,
}

interface ThirdPersonCameraProps {
  target: RefObject<Group | null>
}

export default function ThirdPersonCamera({ target }: ThirdPersonCameraProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const topOffset = useRef(new Vector3(0, 1, -0.5))

  const _quat = useRef(new Quaternion())
  const _yawQuat = useRef(new Quaternion())
  const _euler = useRef(new Euler())
  const _pos = useRef(new Vector3())
  const _worldPos = useRef(new Vector3())
  const _targetQuat = useRef(new Quaternion())
  const initialized = useRef(false)
  const shakePhase = useRef(0)
  const _shakeEuler = useRef(new Euler())
  const _shakeQuat = useRef(new Quaternion())

  const ROTATION_LERP = 0.25

  useFrame((_state, delta) => {
    if (!target.current || !cameraRef.current) return

    target.current.getWorldQuaternion(_quat.current)
    target.current.getWorldPosition(_worldPos.current)

    // Extract yaw only, ignore pitch/roll to prevent vibration
    _euler.current.setFromQuaternion(_quat.current, 'YXZ')
    _yawQuat.current.setFromEuler(_euler.current.set(0, _euler.current.y, 0))

    _pos.current.copy(topOffset.current)
    _pos.current.applyQuaternion(_yawQuat.current)
    _pos.current.add(_worldPos.current)

    const surface = useSurfaceStore.getState().currentSurface
    const speed = useCarStore.getState().speed
    const baseIntensity = SURFACE_SHAKE_INTENSITY[surface] ?? 0
    const baseRotation = SURFACE_SHAKE_ROTATION[surface] ?? 0
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

    _targetQuat.current.copy(_yawQuat.current).multiply(_shakeQuat.current)

    if (!initialized.current) {
      cameraRef.current.quaternion.copy(_targetQuat.current)
      initialized.current = true
    } else {
      cameraRef.current.quaternion.slerp(_targetQuat.current, ROTATION_LERP)
    }
    cameraRef.current.position.copy(_pos.current)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={85} near={0.1} far={1000} />
}
