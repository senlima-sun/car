import { RefObject } from 'react'
import { Group } from 'three'

import { useGameStore } from '../../../stores/useGameStore'
import ThirdPersonCamera from './ThirdPersonCamera'
import FirstPersonCamera from './FirstPersonCamera'
import FreeCamera from './FreeCamera'
import EditorCamera from './EditorCamera'

interface CameraControllerProps {
  target: RefObject<Group | null>
}

export default function CameraController({ target }: CameraControllerProps) {
  const cameraMode = useGameStore(state => state.cameraMode)
  const status = useGameStore(state => state.status)
  const isCustomizeMode = status === 'customize'

  // In customize mode, always use top-down camera
  if (isCustomizeMode) {
    return <EditorCamera />
  }

  return (
    <>
      {cameraMode === 'third-person' && <ThirdPersonCamera target={target} />}
      {cameraMode === 'first-person' && <FirstPersonCamera target={target} />}
      {cameraMode === 'free' && <FreeCamera target={target} />}
    </>
  )
}
