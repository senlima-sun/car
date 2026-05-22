import { useRef } from 'react'
import { Vector3, Quaternion, PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { CAMERA_NEAR, CAMERA_FAR, FLIP_ROTATION } from './constants'
import { extractYawQuaternion, slerpOrSnap } from './utils'
import type { CameraTargetProps } from './types'

const ROTATION_LERP = 0.4
const DRIVER_OFFSET = new Vector3(0, 0.39, 0.2)
const FOV = 64

export default function FirstPersonCamera({ target }: CameraTargetProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const _quat = useRef(new Quaternion())
  const _yawQuat = useRef(new Quaternion())
  const _pos = useRef(new Vector3())
  const _worldPos = useRef(new Vector3())
  const _targetQuat = useRef(new Quaternion())
  const initialized = useRef(false)

  useFrame(() => {
    if (!target.current || !cameraRef.current) return

    target.current.getWorldQuaternion(_quat.current)
    target.current.getWorldPosition(_worldPos.current)

    extractYawQuaternion(_quat.current, _yawQuat.current)

    _pos.current.copy(DRIVER_OFFSET)
    _pos.current.applyQuaternion(_yawQuat.current)
    _pos.current.add(_worldPos.current)

    _targetQuat.current.copy(_yawQuat.current).multiply(FLIP_ROTATION)

    slerpOrSnap(cameraRef.current, _targetQuat.current, ROTATION_LERP, initialized)
    cameraRef.current.position.copy(_pos.current)
  })

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault fov={FOV} near={CAMERA_NEAR} far={CAMERA_FAR} />
  )
}
