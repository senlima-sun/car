import { RefObject } from 'react'
import { Group } from 'three'
import { useGameStore } from '../../../stores/useGameStore'
import ThirdPersonCamera from './ThirdPersonCamera'
import FirstPersonCamera from './FirstPersonCamera'

interface CameraControllerProps {
  target: RefObject<Group | null>
}

export default function CameraController({ target }: CameraControllerProps) {
  const cameraMode = useGameStore(state => state.cameraMode)

  return (
    <>
      {cameraMode === 'third-person' && <ThirdPersonCamera target={target} />}
      {cameraMode === 'first-person' && <FirstPersonCamera target={target} />}
    </>
  )
}
