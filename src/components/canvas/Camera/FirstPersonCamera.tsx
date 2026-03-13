import { useRef } from 'react'
import { Vector3, Quaternion, PerspectiveCamera as ThreePerspectiveCamera } from 'three'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import {
  CAMERA_NEAR,
  CAMERA_FAR,
  FLIP_ROTATION,
  SURFACE_SHAKE_FREQ,
  SURFACE_SHAKE_INTENSITY,
} from './constants'
import { extractYawQuaternion } from './utils'
import { getLookYaw, getLookPitch } from '@/input/cameraLookState'
import { useCarStore } from '@/stores/useCarStore'
import { useSurfaceStore } from '@/stores/useSurfaceStore'
import type { CameraTargetProps } from './types'

const ROTATION_LAMBDA = 14
const POSITION_LAMBDA = 22
const FOV_LAMBDA = 8
const BASE_FOV = 74
const MAX_FOV_BOOST = 4
const DRIVER_OFFSET = new Vector3(0, 1.2, 2.95)
const G_LATERAL_SHIFT = 0.02
const G_LONGITUDINAL_SHIFT = 0.014
const G_LATERAL_ROLL = 0.014
const G_LONGITUDINAL_PITCH = 0.01
const MAX_HEAD_SHIFT_X = 0.08
const MAX_HEAD_SHIFT_Z = 0.06
const MAX_HEAD_ROLL = 0.08
const MAX_HEAD_PITCH = 0.06
const Y_AXIS = new Vector3(0, 1, 0)
const X_AXIS = new Vector3(1, 0, 0)
const Z_AXIS = new Vector3(0, 0, 1)

export default function FirstPersonCamera({ target }: CameraTargetProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null)

  const _quat = useRef(new Quaternion())
  const _yawQuat = useRef(new Quaternion())
  const _baseQuat = useRef(new Quaternion())
  const _pos = useRef(new Vector3())
  const _localPos = useRef(new Vector3())
  const _headLocalOffset = useRef(new Vector3())
  const _vibrationLocalOffset = useRef(new Vector3())
  const _worldPos = useRef(new Vector3())
  const _targetQuat = useRef(new Quaternion())
  const _headRoll = useRef(new Quaternion())
  const _headPitch = useRef(new Quaternion())
  const _lookYaw = useRef(new Quaternion())
  const _lookPitch = useRef(new Quaternion())
  const initialized = useRef(false)
  const vibrationPhase = useRef(0)

  useFrame((_state, delta) => {
    if (!target.current || !cameraRef.current) return
    const dt = Math.min(delta, 0.05)

    const { speed, rpm, lateralG, longitudinalG, skidIntensity } = useCarStore.getState()
    const surface = useSurfaceStore.getState().currentSurface

    target.current.getWorldQuaternion(_quat.current)
    target.current.getWorldPosition(_worldPos.current)

    extractYawQuaternion(_quat.current, _yawQuat.current)

    const bodyBlend = 0.2 + Math.min(speed / 280, 1) * 0.15
    _baseQuat.current.copy(_yawQuat.current).slerp(_quat.current, bodyBlend)

    const headShiftX = Math.max(
      -MAX_HEAD_SHIFT_X,
      Math.min(MAX_HEAD_SHIFT_X, -lateralG * G_LATERAL_SHIFT),
    )
    const headShiftZ = Math.max(
      -MAX_HEAD_SHIFT_Z,
      Math.min(MAX_HEAD_SHIFT_Z, -longitudinalG * G_LONGITUDINAL_SHIFT),
    )

    const vibrationBase = 0.001 + (SURFACE_SHAKE_INTENSITY[surface] ?? 0) * 0.7
    const speedFactor = Math.min(speed / 220, 1.2)
    const rpmFactor = 0.55 + Math.min(rpm / 13000, 1) * 0.8
    const skidFactor = 1 + Math.min(skidIntensity, 1) * 0.5
    const vibration = vibrationBase * speedFactor * rpmFactor * skidFactor
    const freq = 28 + speed * 0.32 + rpm * 0.006
    const freqMult = SURFACE_SHAKE_FREQ[surface] ?? 1
    vibrationPhase.current += dt * freq * (freqMult > 0 ? freqMult : 1)
    const p = vibrationPhase.current

    _vibrationLocalOffset.current.set(
      Math.sin(p * 9.7) * vibration * 0.6,
      (Math.sin(p * 13.4) + Math.sin(p * 21.1) * 0.45) * vibration,
      Math.sin(p * 6.3) * vibration * 0.45,
    )

    _headLocalOffset.current.set(headShiftX, 0, headShiftZ).add(_vibrationLocalOffset.current)

    _localPos.current.copy(DRIVER_OFFSET).add(_headLocalOffset.current)
    _pos.current.copy(_localPos.current)
    _pos.current.applyQuaternion(_baseQuat.current)
    _pos.current.add(_worldPos.current)

    const headRoll = Math.max(-MAX_HEAD_ROLL, Math.min(MAX_HEAD_ROLL, -lateralG * G_LATERAL_ROLL))
    const headPitch = Math.max(
      -MAX_HEAD_PITCH,
      Math.min(MAX_HEAD_PITCH, -longitudinalG * G_LONGITUDINAL_PITCH),
    )
    _headRoll.current.setFromAxisAngle(Z_AXIS, headRoll)
    _headPitch.current.setFromAxisAngle(X_AXIS, headPitch)

    _targetQuat.current
      .copy(_baseQuat.current)
      .multiply(FLIP_ROTATION)
      .multiply(_headPitch.current)
      .multiply(_headRoll.current)

    _lookYaw.current.setFromAxisAngle(Y_AXIS, getLookYaw())
    _lookPitch.current.setFromAxisAngle(X_AXIS, getLookPitch())
    _targetQuat.current.multiply(_lookYaw.current).multiply(_lookPitch.current)

    const rotationAlpha = 1 - Math.exp(-ROTATION_LAMBDA * dt)
    const positionAlpha = 1 - Math.exp(-POSITION_LAMBDA * dt)
    if (!initialized.current) {
      cameraRef.current.quaternion.copy(_targetQuat.current)
      cameraRef.current.position.copy(_pos.current)
      initialized.current = true
    } else {
      cameraRef.current.quaternion.slerp(_targetQuat.current, rotationAlpha)
      cameraRef.current.position.lerp(_pos.current, positionAlpha)
    }

    const targetFov = BASE_FOV + Math.min(speed / 320, 1) * MAX_FOV_BOOST
    const fovAlpha = 1 - Math.exp(-FOV_LAMBDA * dt)
    const nextFov = cameraRef.current.fov + (targetFov - cameraRef.current.fov) * fovAlpha
    if (Math.abs(nextFov - cameraRef.current.fov) > 0.01) {
      cameraRef.current.fov = nextFov
      cameraRef.current.updateProjectionMatrix()
    }
  })

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={BASE_FOV} near={CAMERA_NEAR} far={CAMERA_FAR} />
}
