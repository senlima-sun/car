import { useGameStore } from '../../../stores/useGameStore'
import ThirdPersonCamera from './ThirdPersonCamera'
import FirstPersonCamera from './FirstPersonCamera'
import FreeCamera from './FreeCamera'
import EditorCamera from './EditorCamera'
import type { CameraTargetProps } from './types'

export default function CameraController({ target }: CameraTargetProps) {
  const cameraMode = useGameStore(state => state.cameraMode)
  const status = useGameStore(state => state.status)
  const isCustomizeMode = status === 'customize'

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
