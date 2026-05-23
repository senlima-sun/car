import { useRef, useEffect, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCarStore } from '@/stores/useCarStore'
import { useWheelVisualTuningStore, type WheelVisualKey } from '@/stores/useWheelVisualTuningStore'
import type { GltfWheelRefs } from './BodyFrame'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'

const STEER_LERP_SPEED = 8
const DEFLECTION_LERP_SPEED = 16

const _steerQ = new THREE.Quaternion()
const _spinQ = new THREE.Quaternion()
const _camberQ = new THREE.Quaternion()
const _resultQ = new THREE.Quaternion()
const _steerAxis = new THREE.Vector3(0, 1, 0)
const _spinAxis = new THREE.Vector3(1, 0, 0)
const _camberAxis = new THREE.Vector3(0, 0, 1)
const _spinAxisTuned = new THREE.Vector3(1, 0, 0)
const _offset = new THREE.Vector3()
const SPINNING_WHEEL_PART_PREFIXES = [
  'Wheel_',
  'WheelCover_',
  'WheelHub_',
  'WheelSidewalls_',
  'WheelHubNuts_',
]

interface GltfWheelAnimatorProps {
  wheelRefs: GltfWheelRefs
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
}

export function GltfWheelAnimator({ wheelRefs, suspensionRef }: GltfWheelAnimatorProps) {
  const smoothSteer = useRef(0)
  const smoothDeflections = useRef([0, 0, 0, 0])
  const baseQuaternions = useRef<Map<string, THREE.Quaternion>>(new Map())
  const basePositions = useRef<Map<WheelVisualKey, THREE.Vector3>>(new Map())
  const spinningChildren = useRef<Map<string, THREE.Object3D[]>>(new Map())

  useEffect(() => {
    const map = new Map<string, THREE.Quaternion>()
    const children = new Map<string, THREE.Object3D[]>()
    const positions = new Map<WheelVisualKey, THREE.Vector3>()
    const entries: [WheelVisualKey, THREE.Object3D | null][] = [
      ['fl', wheelRefs.fl],
      ['fr', wheelRefs.fr],
      ['rl', wheelRefs.rl],
      ['rr', wheelRefs.rr],
    ]

    for (const [key, ref] of entries) {
      if (ref) {
        map.set(key, ref.quaternion.clone())
        positions.set(key, ref.position.clone())
        const wheelChildren = ref.children.filter(child =>
          SPINNING_WHEEL_PART_PREFIXES.some(prefix => child.name.startsWith(prefix)),
        )
        children.set(key, wheelChildren)
        for (const child of wheelChildren) {
          map.set(`${key}:${child.name}`, child.quaternion.clone())
        }
      }
    }
    baseQuaternions.current = map
    basePositions.current = positions
    spinningChildren.current = children
  }, [wheelRefs])

  useFrame((_, delta) => {
    const { steerAngle, wheelRotations } = useCarStore.getState()
    const tuning = useWheelVisualTuningStore.getState()
    const suspension = suspensionRef?.current
    const deflectionAlpha = Math.min(1, DEFLECTION_LERP_SPEED * delta)

    smoothSteer.current = THREE.MathUtils.lerp(
      smoothSteer.current,
      steerAngle,
      STEER_LERP_SPEED * delta,
    )
    for (let i = 0; i < 4; i++) {
      smoothDeflections.current[i] = THREE.MathUtils.lerp(
        smoothDeflections.current[i],
        suspension?.wheels[i]?.deflection ?? 0,
        deflectionAlpha,
      )
    }

    const base = baseQuaternions.current

    const applyWheel = (
      ref: THREE.Object3D | null,
      key: WheelVisualKey,
      wheelIndex: number,
      spin: number,
      steer: number | null,
    ) => {
      if (!ref) return
      const bq = base.get(key)
      if (!bq) return
      const position = basePositions.current.get(key)
      const wheelTuning = tuning.wheels[key]
      const spinAxis = wheelTuning.spinAxis
      _spinAxisTuned.set(spinAxis.x, spinAxis.y, spinAxis.z)
      if (_spinAxisTuned.lengthSq() < 0.0001) {
        _spinAxisTuned.copy(_spinAxis)
      } else {
        _spinAxisTuned.normalize()
      }
      if (position) {
        _offset.set(wheelTuning.offset.x, wheelTuning.offset.y, wheelTuning.offset.z)
        _offset.y += smoothDeflections.current[wheelIndex]
        ref.position.copy(position).add(_offset)
      }

      _resultQ.copy(bq)

      if (steer !== null) {
        _steerQ.setFromAxisAngle(_steerAxis, steer)
        _resultQ.premultiply(_steerQ)
      }

      _camberQ.setFromAxisAngle(_camberAxis, THREE.MathUtils.degToRad(wheelTuning.camberDeg))
      _resultQ.multiply(_camberQ)

      ref.quaternion.copy(_resultQ)

      _spinQ.setFromAxisAngle(_spinAxisTuned, spin * wheelTuning.spinSign)
      for (const child of spinningChildren.current.get(key) ?? []) {
        const childBase = base.get(`${key}:${child.name}`)
        if (!childBase) continue
        child.quaternion.copy(childBase).multiply(_spinQ)
      }
    }

    applyWheel(wheelRefs.fl, 'fl', 0, wheelRotations[0], smoothSteer.current)
    applyWheel(wheelRefs.fr, 'fr', 1, wheelRotations[1], smoothSteer.current)
    applyWheel(wheelRefs.rl, 'rl', 2, wheelRotations[2], null)
    applyWheel(wheelRefs.rr, 'rr', 3, wheelRotations[3], null)
  })

  return null
}
