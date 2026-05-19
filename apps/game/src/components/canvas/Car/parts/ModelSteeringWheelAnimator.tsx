import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SteeringWheelRefs } from './BodyFrame'
import { readSteeringWheelAngle } from './steeringWheelAngle'

const STEER_LERP_SPEED = 18

const _steerQ = new THREE.Quaternion()
const _resultQ = new THREE.Quaternion()
const _steeringAxis = new THREE.Vector3(0, 0, 1)

interface ModelSteeringWheelAnimatorProps {
  steeringWheelRefs: SteeringWheelRefs
}

export function ModelSteeringWheelAnimator({ steeringWheelRefs }: ModelSteeringWheelAnimatorProps) {
  const smoothSteer = useRef(0)
  const baseQuaternion = useRef<THREE.Quaternion | null>(null)

  useEffect(() => {
    baseQuaternion.current = steeringWheelRefs.assembly?.quaternion.clone() ?? null
  }, [steeringWheelRefs])

  useFrame((_, delta) => {
    const ref = steeringWheelRefs.assembly
    const base = baseQuaternion.current
    if (!ref || !base) return

    smoothSteer.current = THREE.MathUtils.lerp(
      smoothSteer.current,
      readSteeringWheelAngle(),
      Math.min(STEER_LERP_SPEED * delta, 1),
    )

    _steerQ.setFromAxisAngle(_steeringAxis, smoothSteer.current)
    _resultQ.copy(base).multiply(_steerQ)
    ref.quaternion.copy(_resultQ)
  })

  return null
}
