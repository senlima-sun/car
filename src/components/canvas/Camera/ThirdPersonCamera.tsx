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

  // Fixed camera offset at top of car (no speed pull effect)
  const topOffset = useRef(new Vector3(0, 3, -5))

  // 180 degree rotation to flip camera forward
  const flipRotation = useRef(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI))

  useFrame(() => {
    if (!target.current || !cameraRef.current) return

    // Get car's rotation
    const carQuaternion = new Quaternion()
    target.current.getWorldQuaternion(carQuaternion)

    // Calculate camera position in world space (fixed to car)
    const worldMatrix = new Matrix4()
    target.current.updateMatrixWorld()
    worldMatrix.copy(target.current.matrixWorld)

    const cameraPosition = topOffset.current.clone()
    cameraPosition.applyMatrix4(worldMatrix)

    // Set camera position and rotation (flipped to face forward)
    cameraRef.current.position.copy(cameraPosition)
    cameraRef.current.quaternion.copy(carQuaternion).multiply(flipRotation.current)
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={85} near={0.1} far={1000} />
}
