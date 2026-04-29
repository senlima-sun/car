import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import CarBody from '../Car/parts/CarBody'
import { WHEEL_RADIUS } from '@/constants/dimensions'
import { isMenuStatus, useGameStore } from '@/stores/useGameStore'
import { useShowroomStore } from '@/stores/useShowroomStore'
import { createCarbonFiberMaterial, createRubberMaterial } from './carbonMaterial'

const TIRE_NAME_PREFIX = 'Wheel_'
const WHEEL_COVER_PREFIX = 'WheelCover_'

function isTireMesh(mesh: THREE.Mesh): boolean {
  let obj: THREE.Object3D | null = mesh
  while (obj) {
    const name = obj.name
    if (name.startsWith(WHEEL_COVER_PREFIX)) return false
    if (name.startsWith(TIRE_NAME_PREFIX)) return true
    obj = obj.parent
  }
  return false
}

const CAR_OFFSET: [number, number, number] = [0, 0.2, -0.45]
const ORBIT_TARGET: [number, number, number] = [0, 2.55, 0]
const CAMERA_POSITION: [number, number, number] = [7, 1, 4.5]
const CAMERA_FOV = 45
const AUTO_ROTATE_SPEED = 1

export default function PreviewScene() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const carGroupRef = useRef<THREE.Group>(null)
  const introRef = useRef(0)

  const status = useGameStore(s => s.status)
  const isMenuMode = isMenuStatus(status)

  const showroom = useShowroomStore()

  const carbonMaterial = useMemo(() => createCarbonFiberMaterial(), [])
  const rubberMaterial = useMemo(() => createRubberMaterial(), [])
  const patchedMeshesRef = useRef(new WeakSet<THREE.Mesh>())
  const originalMaterialsRef = useRef(new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>())
  const patchTickRef = useRef(0)

  useEffect(() => {
    introRef.current = 0
    return () => {
      carbonMaterial.dispose()
      rubberMaterial.dispose()
    }
  }, [carbonMaterial, rubberMaterial])

  useEffect(() => {
    if (isMenuMode) return
    const group = carGroupRef.current
    if (!group) return
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const original = originalMaterialsRef.current.get(child)
        if (original) {
          child.material = original
          originalMaterialsRef.current.delete(child)
          patchedMeshesRef.current.delete(child)
        }
      }
    })
  }, [isMenuMode])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (controls) {
      introRef.current = Math.min(1, introRef.current + delta * 0.6)
      const eased = 1 - Math.pow(1 - introRef.current, 3)
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED * eased
    }

    const group = carGroupRef.current
    if (!group) return

    group.position.set(
      CAR_OFFSET[0],
      WHEEL_RADIUS + CAR_OFFSET[1] + Math.sin(performance.now() * 0.0008) * 0.015,
      CAR_OFFSET[2],
    )

    if (isMenuMode) {
      patchTickRef.current += 1
      if (patchTickRef.current % 15 === 0) {
        group.traverse(child => {
          if (child instanceof THREE.Mesh && !patchedMeshesRef.current.has(child)) {
            originalMaterialsRef.current.set(child, child.material)
            child.material = isTireMesh(child) ? rubberMaterial : carbonMaterial
            patchedMeshesRef.current.add(child)
          }
        })
      }
    }
  })

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={CAMERA_FOV}
        near={0.1}
        far={200}
        position={CAMERA_POSITION}
      />
      <OrbitControls
        ref={controlsRef}
        target={ORBIT_TARGET}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2 + 0.05}
        autoRotate
        autoRotateSpeed={AUTO_ROTATE_SPEED}
        enablePan={false}
      />

      <Environment preset='studio' environmentIntensity={0.8} />
      <ambientLight intensity={showroom.ambientIntensity} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={showroom.keyLightIntensity}
        color={showroom.keyLightColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-5, 6, -3]}
        intensity={showroom.fillLightIntensity}
        color={showroom.fillLightColor}
      />
      <directionalLight
        position={[0, 4, -8]}
        intensity={showroom.rimLightIntensity}
        color={showroom.rimLightColor}
      />
      <hemisphereLight
        args={[showroom.hemiSkyColor, showroom.hemiGroundColor, showroom.hemiIntensity]}
      />
      <spotLight
        position={[0, 9, 0]}
        angle={0.7}
        penumbra={0.8}
        intensity={showroom.topLightIntensity}
        color={showroom.topLightColor}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color={showroom.floorColor} roughness={0.95} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[6, 6.08, 96]} />
        <meshBasicMaterial color={showroom.ringColor} transparent opacity={showroom.ringOpacity} />
      </mesh>

      <Suspense fallback={null}>
        <group ref={carGroupRef} position={[0, WHEEL_RADIUS, 0]}>
          <CarBody />
        </group>
      </Suspense>
    </>
  )
}
