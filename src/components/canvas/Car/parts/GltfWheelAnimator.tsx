import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '@/stores/useCarStore'
import type { GltfWheelRefs } from './BodyFrame'

const STEER_LERP_SPEED = 8

const _steerQ = new THREE.Quaternion()
const _spinQ = new THREE.Quaternion()
const _resultQ = new THREE.Quaternion()
const _upAxis = new THREE.Vector3(0, 0, 1)
const _spinAxis = new THREE.Vector3(0, 0, 1)

interface GltfWheelAnimatorProps {
  wheelRefs: GltfWheelRefs
}

export function GltfWheelAnimator({ wheelRefs }: GltfWheelAnimatorProps) {
  const smoothSteer = useRef(0)
  const baseQuaternions = useRef<Map<string, THREE.Quaternion>>(new Map())

  useEffect(() => {
    const map = new Map<string, THREE.Quaternion>()
    const entries = [
      ['fl', wheelRefs.fl],
      ['fr', wheelRefs.fr],
      ['rl', wheelRefs.rl],
      ['rr', wheelRefs.rr],
    ] as const

    for (const [key, ref] of entries) {
      if (ref) {
        map.set(key, ref.quaternion.clone())
      }
    }
    baseQuaternions.current = map
  }, [wheelRefs])

  useFrame((_, delta) => {
    const { steerAngle, wheelRotations } = useCarStore.getState()

    smoothSteer.current = THREE.MathUtils.lerp(
      smoothSteer.current,
      steerAngle,
      STEER_LERP_SPEED * delta,
    )

    const base = baseQuaternions.current

    const applyWheel = (
      ref: THREE.Object3D | null,
      key: string,
      spin: number,
      steer: number | null,
    ) => {
      if (!ref) return
      const bq = base.get(key)
      if (!bq) return

      _resultQ.copy(bq)

      if (steer !== null) {
        _steerQ.setFromAxisAngle(_upAxis, steer)
        _resultQ.premultiply(_steerQ)
      }

      _spinQ.setFromAxisAngle(_spinAxis, spin)
      _resultQ.multiply(_spinQ)

      ref.quaternion.copy(_resultQ)
    }

    applyWheel(wheelRefs.fl, 'fl', wheelRotations[0], smoothSteer.current)
    applyWheel(wheelRefs.fr, 'fr', wheelRotations[1], smoothSteer.current)
    applyWheel(wheelRefs.rl, 'rl', wheelRotations[2], null)
    applyWheel(wheelRefs.rr, 'rr', wheelRotations[3], null)
  })

  return null
}
