import { useRef } from 'react'
import { Vector3, Quaternion, Euler, PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { useGhostPreferenceStore } from '../../../stores/useGhostPreferenceStore'
import { useAiGhostStore } from '../../../stores/useAiGhostStore'
import { CAMERA_NEAR, CAMERA_FAR } from './constants'
import { slerpOrSnap } from './utils'
import type { CameraTargetProps } from './types'

const CAMERA_HEIGHT = 80
const CAMERA_PITCH_RADIANS = -Math.PI / 2 + 0.18
const POSITION_LERP = 0.12
const ROTATION_LERP = 0.2
const FOV = 50

export default function TopDownCamera({ target }: CameraTargetProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const _worldPos = useRef(new Vector3())
  const _desiredPos = useRef(new Vector3())
  const _targetQuat = useRef(new Quaternion())
  const _euler = useRef(new Euler(CAMERA_PITCH_RADIANS, 0, 0, 'YXZ'))
  const initialized = useRef(false)

  useFrame(() => {
    if (!cameraRef.current) return

    const spectatorMode = useGhostPreferenceStore.getState().spectatorMode
    const ghostPos = useAiGhostStore.getState().ghostPosition

    if (spectatorMode && ghostPos !== null) {
      _worldPos.current.set(ghostPos[0], ghostPos[1], ghostPos[2])
    } else if (target.current) {
      target.current.getWorldPosition(_worldPos.current)
    } else {
      return
    }

    _desiredPos.current.set(
      _worldPos.current.x,
      _worldPos.current.y + CAMERA_HEIGHT,
      _worldPos.current.z + CAMERA_HEIGHT * 0.18,
    )

    if (!initialized.current) {
      cameraRef.current.position.copy(_desiredPos.current)
    } else {
      cameraRef.current.position.lerp(_desiredPos.current, POSITION_LERP)
    }

    _targetQuat.current.setFromEuler(_euler.current)
    slerpOrSnap(cameraRef.current, _targetQuat.current, ROTATION_LERP, initialized)
  })

  return (
    <PerspectiveCamera ref={cameraRef} makeDefault fov={FOV} near={CAMERA_NEAR} far={CAMERA_FAR} />
  )
}
