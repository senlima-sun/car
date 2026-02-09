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

interface ThirdPersonCameraProps {
  target: RefObject<Group | null>
}

export default function ThirdPersonCamera({ target }: ThirdPersonCameraProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const topOffset = useRef(new Vector3(0, 1, -0.5))
  const flipRotation = useRef(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI))

  const _quat = useRef(new Quaternion())
  const _yawQuat = useRef(new Quaternion())
  const _euler = useRef(new Euler())
  const _pos = useRef(new Vector3())
  const _worldPos = useRef(new Vector3())
  const _targetQuat = useRef(new Quaternion())
  const initialized = useRef(false)

  const ROTATION_LERP = 0.25

  useFrame(() => {
    if (!target.current || !cameraRef.current) return

    target.current.getWorldQuaternion(_quat.current)
    target.current.getWorldPosition(_worldPos.current)

    // Extract yaw only, ignore pitch/roll to prevent vibration
    _euler.current.setFromQuaternion(_quat.current, 'YXZ')
    _yawQuat.current.setFromEuler(_euler.current.set(0, _euler.current.y, 0))

    _pos.current.copy(topOffset.current)
    _pos.current.applyQuaternion(_yawQuat.current)
    _pos.current.add(_worldPos.current)

    _targetQuat.current.copy(_yawQuat.current).multiply(flipRotation.current)

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
