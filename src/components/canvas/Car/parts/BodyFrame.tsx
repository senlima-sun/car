import { MutableRefObject, useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { SuspensionLinkageGroup } from './SuspensionLinkage'
import type { SuspensionOutput } from '../hooks/useRaycastSuspension'
import { WHEELBASE } from '@/constants/dimensions'
import { useTireStore } from '@/stores/useTireStore'
import { TIRE_COMPOUND } from '@/constants/colors'

const MODEL_PATH = '/models/f1_2026.glb'

const WHEEL_NAMES = ['WheelAssembly_FL', 'WheelAssembly_FR', 'WheelAssembly_RL', 'WheelAssembly_RR'] as const
const WHEEL_COVER_NAMES = ['WheelCover_FL', 'WheelCover_FR', 'WheelCover_RL', 'WheelCover_RR'] as const
const WHEEL_TIRE_NAMES = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'] as const

export interface GltfWheelRefs {
  fl: THREE.Object3D | null
  fr: THREE.Object3D | null
  rl: THREE.Object3D | null
  rr: THREE.Object3D | null
}

interface BodyFrameProps {
  isRaining: boolean
  isThermalView: boolean
  engineThermalMaterial: THREE.ShaderMaterial
  suspensionRef?: MutableRefObject<SuspensionOutput | null>
  onWheelRefs?: (refs: GltfWheelRefs) => void
}

export function BodyFrame({ isRaining, suspensionRef, onWheelRefs }: BodyFrameProps) {
  const { scene } = useGLTF(MODEL_PATH, true)
  const bodyRef = useRef<THREE.Group>(null)
  const currentCompound = useTireStore((s) => s.currentCompound)

  const bodyScene = useMemo(() => {
    const cloned = scene.clone(true)
    const wheelMeshSet = new Set<string>([...WHEEL_COVER_NAMES, ...WHEEL_TIRE_NAMES])
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (wheelMeshSet.has(child.name) && child.material instanceof THREE.MeshStandardMaterial) {
          child.material = child.material.clone()
        }
      }
    })
    return cloned
  }, [scene])

  useEffect(() => {
    const f1Car = bodyScene.getObjectByName('F1_Car')
    if (!f1Car || !onWheelRefs) return
    onWheelRefs({
      fl: f1Car.getObjectByName(WHEEL_NAMES[0]) ?? null,
      fr: f1Car.getObjectByName(WHEEL_NAMES[1]) ?? null,
      rl: f1Car.getObjectByName(WHEEL_NAMES[2]) ?? null,
      rr: f1Car.getObjectByName(WHEEL_NAMES[3]) ?? null,
    })
  }, [bodyScene, onWheelRefs])

  useEffect(() => {
    const f1Car = bodyScene.getObjectByName('F1_Car')
    if (!f1Car) return
    const compoundColor = new THREE.Color(TIRE_COMPOUND[currentCompound])

    for (const name of WHEEL_COVER_NAMES) {
      const obj = f1Car.getObjectByName(name)
      if (!(obj instanceof THREE.Mesh)) continue
      const mat = obj.material
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue
      mat.map = null
      mat.color.copy(compoundColor)
      mat.emissive.copy(compoundColor)
      mat.emissiveIntensity = 0.15
      mat.needsUpdate = true
    }

    const targetR = Math.round(compoundColor.r * 255)
    const targetG = Math.round(compoundColor.g * 255)
    const targetB = Math.round(compoundColor.b * 255)

    for (const name of WHEEL_TIRE_NAMES) {
      const obj = f1Car.getObjectByName(name)
      if (!(obj instanceof THREE.Mesh)) continue
      const mat = obj.material
      if (!(mat instanceof THREE.MeshStandardMaterial) || !mat.map) continue
      const srcImage = mat.map.image
      if (!srcImage) continue

      const canvas = document.createElement('canvas')
      canvas.width = srcImage.width
      canvas.height = srcImage.height
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.drawImage(srcImage, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const px = imageData.data

      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2]
        if (r > 150 && g < 80 && b < 80) {
          const brightness = r / 255
          px[i] = Math.round(targetR * brightness)
          px[i + 1] = Math.round(targetG * brightness)
          px[i + 2] = Math.round(targetB * brightness)
        }
      }

      ctx.putImageData(imageData, 0, 0)
      mat.map = new THREE.CanvasTexture(canvas)
      mat.map.flipY = false
      mat.needsUpdate = true
    }
  }, [bodyScene, currentCompound])

  useEffect(() => {
    if (!bodyRef.current) return
    bodyRef.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const mat = child.material
      if (!(mat instanceof THREE.MeshStandardMaterial)) return
      if (isRaining) {
        mat.roughness = Math.min(mat.roughness, 0.15)
        mat.envMapIntensity = 2.5
      }
      mat.needsUpdate = true
    })
  }, [isRaining])

  return (
    <group>
      <group
        ref={bodyRef}
        position={[0, -0.37, WHEELBASE / 2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <primitive object={bodyScene} />
      </group>
      <group visible={false}>
        <SuspensionLinkageGroup isRaining={isRaining} suspensionRef={suspensionRef} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_PATH, true)
