import { isCustomizeStatus, useGameStore } from '../../../stores/useGameStore'
import { useGhostPreferenceStore } from '../../../stores/useGhostPreferenceStore'
import ThirdPersonCamera from './ThirdPersonCamera'
import FirstPersonCamera from './FirstPersonCamera'
import FreeCamera from './FreeCamera'
import TopDownCamera from './TopDownCamera'
import EditorCamera from './EditorCamera'
import type { CameraTargetProps } from './types'

export default function CameraController({ target }: CameraTargetProps) {
  const cameraMode = useGameStore(state => state.cameraMode)
  const status = useGameStore(state => state.status)
  const spectatorMode = useGhostPreferenceStore(state => state.spectatorMode)
  const isCustomizeMode = isCustomizeStatus(status)

  if (isCustomizeMode) {
    return <EditorCamera />
  }

  const effectiveMode = spectatorMode && cameraMode === 'first-person' ? 'third-person' : cameraMode

  return (
    <>
      {effectiveMode === 'third-person' && <ThirdPersonCamera target={target} />}
      {effectiveMode === 'first-person' && <FirstPersonCamera target={target} />}
      {effectiveMode === 'top-down' && <TopDownCamera target={target} />}
      {effectiveMode === 'free' && <FreeCamera target={target} />}
    </>
  )
}
