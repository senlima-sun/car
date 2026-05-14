import { type MutableRefObject, useMemo, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CAR_SCALE } from '@/constants/physics'
import { WHEELBASE } from '@/constants/dimensions'

const MODEL_PATH = '/models/f1_2026.glb'
const GHOST_COLOR = new THREE.Color(0x00ccff)
const GHOST_OPACITY = 0.5
const GHOST_EMISSIVE_INTENSITY = 0.4

const WHEEL_NAMES = [
  'WheelAssembly_FL',
  'WheelAssembly_FR',
  'WheelAssembly_RL',
  'WheelAssembly_RR',
] as const
const STEER_LERP_SPEED = 8
const PULSE_SPEED = 2
const PULSE_MIN = 0.35
const PULSE_MAX = 0.55

const _steerQ = new THREE.Quaternion()
const _spinQ = new THREE.Quaternion()
const _resultQ = new THREE.Quaternion()
const _upAxis = new THREE.Vector3(0, 1, 0)
const _spinAxis = new THREE.Vector3(0, 0, 1)

interface WheelRefs {
  fl: THREE.Object3D | null
  fr: THREE.Object3D | null
  rl: THREE.Object3D | null
  rr: THREE.Object3D | null
}

interface GhostCarBodyProps {
  steerRef: MutableRefObject<number>
  wheelsRef: MutableRefObject<[number, number, number, number]>
}

export function GhostCarBody({ steerRef, wheelsRef }: GhostCarBodyProps) {
  const { scene } = useGLTF(MODEL_PATH, true)
  const wheelRefsLocal = useRef<WheelRefs>({ fl: null, fr: null, rl: null, rr: null })
  const baseQuaternions = useRef<Map<string, THREE.Quaternion>>(new Map())
  const smoothSteer = useRef(0)
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([])
  const elapsedRef = useRef(0)

  const ghostScene = useMemo(() => {
    const mats: THREE.MeshStandardMaterial[] = []
    const cloned = scene.clone(true)
    cloned.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false
        child.receiveShadow = false
        const srcMat = child.material
        if (srcMat instanceof THREE.MeshStandardMaterial) {
          const mat = srcMat.clone()
          mat.transparent = true
          mat.opacity = GHOST_OPACITY
          mat.emissive = GHOST_COLOR
          mat.emissiveIntensity = GHOST_EMISSIVE_INTENSITY
          mat.depthWrite = false
          mat.map = null
          mat.needsUpdate = true
          child.material = mat
          mats.push(mat)
        }
      }
    })
    materialsRef.current = mats
    return cloned
  }, [scene])

  useEffect(() => {
    return () => {
      ghostScene.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (child.material instanceof THREE.Material) {
            child.material.dispose()
          }
        }
      })
    }
  }, [ghostScene])

  const handleWheelRefs = useCallback(() => {
    const f1Car = ghostScene.getObjectByName('F1_Car')
    if (!f1Car) return
    const refs: WheelRefs = {
      fl: f1Car.getObjectByName(WHEEL_NAMES[0]) ?? null,
      fr: f1Car.getObjectByName(WHEEL_NAMES[1]) ?? null,
      rl: f1Car.getObjectByName(WHEEL_NAMES[2]) ?? null,
      rr: f1Car.getObjectByName(WHEEL_NAMES[3]) ?? null,
    }
    wheelRefsLocal.current = refs

    const map = new Map<string, THREE.Quaternion>()
    const entries = [
      ['fl', refs.fl],
      ['fr', refs.fr],
      ['rl', refs.rl],
      ['rr', refs.rr],
    ] as const
    for (const [key, ref] of entries) {
      if (ref) {
        map.set(key, ref.quaternion.clone())
      }
    }
    baseQuaternions.current = map
  }, [ghostScene])

  useEffect(() => {
    handleWheelRefs()
  }, [handleWheelRefs])

  useFrame((_, delta) => {
    const targetSteer = steerRef.current
    const wr = wheelsRef.current
    const base = baseQuaternions.current

    smoothSteer.current = THREE.MathUtils.lerp(
      smoothSteer.current,
      targetSteer,
      STEER_LERP_SPEED * delta,
    )

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

    applyWheel(wheelRefsLocal.current.fl, 'fl', wr[0], smoothSteer.current)
    applyWheel(wheelRefsLocal.current.fr, 'fr', wr[1], smoothSteer.current)
    applyWheel(wheelRefsLocal.current.rl, 'rl', wr[2], null)
    applyWheel(wheelRefsLocal.current.rr, 'rr', wr[3], null)

    elapsedRef.current += delta
    const pulse =
      PULSE_MIN + (PULSE_MAX - PULSE_MIN) * (0.5 + 0.5 * Math.sin(elapsedRef.current * PULSE_SPEED))
    for (const mat of materialsRef.current) {
      mat.opacity = pulse
    }
  })

  return (
    <group scale={CAR_SCALE}>
      <group position={[0, -0.37, WHEELBASE / 2]} rotation={[0, Math.PI / 2, 0]}>
        <primitive object={ghostScene} />
      </group>
    </group>
  )
}
