import { useRef, RefObject } from 'react'
import {
  Vector3,
  Quaternion,
  PerspectiveCamera as ThreePerspectiveCamera,
  Group,
  Matrix4,
} from 'three'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'

interface ThirdPersonCameraProps {
  target: RefObject<Group | null>
}

export default function ThirdPersonCamera({ target }: ThirdPersonCameraProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const topOffset = useRef(new Vector3(0, 3, -5))
  const flipRotation = useRef(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI))

  const _quat = useRef(new Quaternion())
  const _mat = useRef(new Matrix4())
  const _pos = useRef(new Vector3())

  useFrame(() => {
    if (!target.current || !cameraRef.current) return

    target.current.getWorldQuaternion(_quat.current)

    target.current.updateMatrixWorld()
    _mat.current.copy(target.current.matrixWorld)

    _pos.current.copy(topOffset.current)
    _pos.current.applyMatrix4(_mat.current)

    cameraRef.current.position.copy(_pos.current)
    cameraRef.current.quaternion.copy(_quat.current).multiply(flipRotation.current)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={85} near={0.1} far={1000} />
}
