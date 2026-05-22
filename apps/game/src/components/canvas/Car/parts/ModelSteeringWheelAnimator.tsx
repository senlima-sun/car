import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SteeringWheelRefs } from './BodyFrame'
import { readSteeringWheelAngle } from './steeringWheelAngle'

const STEER_LERP_SPEED = 18

const _steerQ = new THREE.Quaternion()
const _resultQ = new THREE.Quaternion()
const _steeringAxis = new THREE.Vector3(0, 1, 0)
const _baseEuler = new THREE.Euler()
const _baseAdjustQ = new THREE.Quaternion()
const STEER_BASE_ROT_X = 1.5
const STEER_OFFSET_X = 0
const STEER_OFFSET_Y = -0.005
const STEER_OFFSET_Z = 0

interface ModelSteeringWheelAnimatorProps {
  steeringWheelRefs: SteeringWheelRefs
}

export function ModelSteeringWheelAnimator({ steeringWheelRefs }: ModelSteeringWheelAnimatorProps) {
  const smoothSteer = useRef(0)
  const baseQuaternion = useRef<THREE.Quaternion | null>(null)
  const basePosition = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    baseQuaternion.current = steeringWheelRefs.assembly?.quaternion.clone() ?? null
    basePosition.current = steeringWheelRefs.assembly?.position.clone() ?? null
  }, [steeringWheelRefs])

  useFrame((_, delta) => {
    const ref = steeringWheelRefs.assembly
    const baseQ = baseQuaternion.current
    const baseP = basePosition.current
    if (!ref || !baseQ || !baseP) return

    smoothSteer.current = THREE.MathUtils.lerp(
      smoothSteer.current,
      readSteeringWheelAngle(),
      Math.min(STEER_LERP_SPEED * delta, 1),
    )

    _baseEuler.set(STEER_BASE_ROT_X, 0, 0)
    _baseAdjustQ.setFromEuler(_baseEuler)

    _steerQ.setFromAxisAngle(_steeringAxis, smoothSteer.current)
    _resultQ.copy(baseQ).multiply(_baseAdjustQ).multiply(_steerQ)
    ref.quaternion.copy(_resultQ)

    ref.position.set(
      baseP.x + STEER_OFFSET_X,
      baseP.y + STEER_OFFSET_Y,
      baseP.z + STEER_OFFSET_Z,
    )
  })

  return null
}
