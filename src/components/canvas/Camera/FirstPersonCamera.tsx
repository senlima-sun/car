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

interface FirstPersonCameraProps {
  target: RefObject<Group | null>
}

export default function FirstPersonCamera({ target }: FirstPersonCameraProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const driverOffset = useRef(new Vector3(0, 0.45, 0.45))

  const _quat = useRef(new Quaternion())
  const _yawQuat = useRef(new Quaternion())
  const _euler = useRef(new Euler())
  const _pos = useRef(new Vector3())
  const _worldPos = useRef(new Vector3())
  const _targetQuat = useRef(new Quaternion())
  const initialized = useRef(false)

  const ROTATION_LERP = 0.4

  useFrame(() => {
    if (!target.current || !cameraRef.current) return

    target.current.getWorldQuaternion(_quat.current)
    target.current.getWorldPosition(_worldPos.current)

    // Extract yaw only, ignore pitch/roll to prevent vibration
    _euler.current.setFromQuaternion(_quat.current, 'YXZ')
    _yawQuat.current.setFromEuler(_euler.current.set(0, _euler.current.y, 0))

    _pos.current.copy(driverOffset.current)
    _pos.current.applyQuaternion(_yawQuat.current)
    _pos.current.add(_worldPos.current)

    _targetQuat.current.copy(_yawQuat.current)

    if (!initialized.current) {
      cameraRef.current.quaternion.copy(_targetQuat.current)
      initialized.current = true
    } else {
      cameraRef.current.quaternion.slerp(_targetQuat.current, ROTATION_LERP)
    }
    cameraRef.current.position.copy(_pos.current)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={90} near={0.1} far={1000} />
}
