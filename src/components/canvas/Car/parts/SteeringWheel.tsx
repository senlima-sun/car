import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useSteeringWheelDisplay } from './SteeringWheelDisplay'
import { useCarStore } from '@/stores/useCarStore'
import { useSwDisplayStore } from '@/stores/useSwDisplayStore'

const MODEL_PATH = '/models/steering-wheel.glb'
const MAX_RPM = 12500

const RPM_COLORS = [
  '#22c55e',
  '#22c55e',
  '#22c55e',
  '#22c55e',
  '#22c55e',
  '#eab308',
  '#eab308',
  '#eab308',
  '#eab308',
  '#ef4444',
  '#ef4444',
  '#ef4444',
  '#3b82f6',
  '#3b82f6',
  '#3b82f6',
]
const RPM_LED_COUNT = RPM_COLORS.length

interface SteeringWheelProps {
  steerAngle: number
  showDisplay: boolean
}

export function SteeringWheel({ steerAngle }: SteeringWheelProps) {
  const { scene } = useGLTF(MODEL_PATH, true)
  const steeringWheelRef = useRef<THREE.Group>(null)
  const smoothSteeringWheel = useRef(0)
  useSteeringWheelDisplay()

  const { clonedScene, ledMaterials, displayMesh } = useMemo(() => {
    const cloned = scene.clone(true)
    const { texture } = useSwDisplayStore.getState()

    cloned.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    let display: THREE.Mesh | null = null
    const swDisplay = cloned.getObjectByName('SW_Display')
    if (swDisplay instanceof THREE.Mesh) {
      swDisplay.material = new THREE.MeshBasicMaterial({
        map: texture,
        toneMapped: false,
      })
      display = swDisplay
    }

    const mats: THREE.MeshBasicMaterial[] = []
    for (let i = 0; i < RPM_LED_COUNT; i++) {
      const name = `RPM_LED_${String(i).padStart(2, '0')}`
      const ledObj = cloned.getObjectByName(name)
      const mat = new THREE.MeshBasicMaterial({
        color: RPM_COLORS[i],
        toneMapped: false,
        transparent: true,
        opacity: 0.08,
      })
      if (ledObj instanceof THREE.Mesh) {
        ledObj.material = mat
        ledObj.renderOrder = 1
      }
      mats.push(mat)
    }

    return { clonedScene: cloned, ledMaterials: mats, displayMesh: display }
  }, [scene])

  useFrame((_, delta) => {
    const lerpSpeed = 8
    smoothSteeringWheel.current = THREE.MathUtils.lerp(
      smoothSteeringWheel.current,
      steerAngle,
      lerpSpeed * delta,
    )

    if (steeringWheelRef.current) {
      steeringWheelRef.current.rotation.y = smoothSteeringWheel.current * 1.5
      steeringWheelRef.current.rotation.z = smoothSteeringWheel.current * 0.1
    }

    const rpm = useCarStore.getState().rpm
    const rpmRatio = Math.min(1, rpm / MAX_RPM)
    const lit = Math.round(rpmRatio * RPM_LED_COUNT)

    for (let i = 0; i < RPM_LED_COUNT; i++) {
      ledMaterials[i].opacity = i < lit ? 1.0 : 0.08
    }

    if (displayMesh) {
      displayMesh.position.set(0, 0.042, -0.028)
      displayMesh.scale.set(0.85, 1, 0.9)
    }
  })

  return (
    <group position={[0, 1.03, 3.25]} rotation={[1.4484, -0.0016, 3.1384]} scale={1.65}>
      <group ref={steeringWheelRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_PATH, true)
