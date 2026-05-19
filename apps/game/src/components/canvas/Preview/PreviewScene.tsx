import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import CarBody from '../Car/parts/CarBody'
import { WHEEL_RADIUS } from '@/constants/dimensions'
import { isMenuStatus, useGameStore } from '@/stores/useGameStore'
import { useShowroomStore } from '@/stores/useShowroomStore'
import { getPartIdForMesh, useCarPaintStore } from '@/stores/useCarPaintStore'
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

const CAR_OFFSET: [number, number, number] = [-3, 0.2, -0.45]
const ORBIT_TARGET: [number, number, number] = [-3, 1.6, -0.45]
const CAMERA_POSITION: [number, number, number] = [7, 1, 4.5]
const CAMERA_FOV = 45

function findPaintPart(object: THREE.Object3D | null, boundary: THREE.Object3D | null) {
  let current = object
  while (current && current !== boundary) {
    const partId = getPartIdForMesh(current.name)
    if (partId) return partId
    current = current.parent
  }
  return null
}

export default function PreviewScene() {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const carGroupRef = useRef<THREE.Group>(null)
  const gl = useThree(s => s.gl)

  const status = useGameStore(s => s.status)
  const isMenuMode = isMenuStatus(status)

  const showroom = useShowroomStore()

  const carbonMaterial = useMemo(() => createCarbonFiberMaterial(), [])
  const rubberMaterial = useMemo(() => createRubberMaterial(), [])
  const patchedMeshesRef = useRef(new WeakSet<THREE.Mesh>())
  const originalMaterialsRef = useRef(new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>())
  const patchTickRef = useRef(0)

  useEffect(() => {
    return () => {
      carbonMaterial.dispose()
      rubberMaterial.dispose()
      useShowroomStore.getState().setHoveredPart(null)
      document.body.style.cursor = ''
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

  const setHoveredPart = useCallback((partId: ReturnType<typeof findPaintPart>) => {
    useShowroomStore.getState().setHoveredPart(partId)
    document.body.style.cursor = partId ? 'pointer' : ''
  }, [])

  const clearHoveredPart = useCallback(() => {
    setHoveredPart(null)
  }, [setHoveredPart])

  useEffect(() => {
    const element = gl.domElement
    element.addEventListener('pointerleave', clearHoveredPart)
    return () => element.removeEventListener('pointerleave', clearHoveredPart)
  }, [clearHoveredPart, gl])

  const handlePartPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const partId = findPaintPart(event.object, carGroupRef.current)
      setHoveredPart(partId)
    },
    [setHoveredPart],
  )

  const handlePartPointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const partId = findPaintPart(event.object, carGroupRef.current)
      setHoveredPart(partId)
    },
    [setHoveredPart],
  )

  const handlePartClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const partId = findPaintPart(event.object, carGroupRef.current)
      if (!partId) return
      event.stopPropagation()
      setHoveredPart(partId)
      useCarPaintStore.getState().setSelectedPart(partId)
    },
    [setHoveredPart],
  )

  useFrame(() => {
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
        enableRotate
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

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onPointerMove={clearHoveredPart}
      >
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color={showroom.floorColor} roughness={0.95} metalness={0.05} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerMove={clearHoveredPart}>
        <ringGeometry args={[6, 6.08, 96]} />
        <meshBasicMaterial color={showroom.ringColor} transparent opacity={showroom.ringOpacity} />
      </mesh>

      <Suspense fallback={null}>
        <group
          ref={carGroupRef}
          position={[0, WHEEL_RADIUS, 0]}
          onPointerMove={handlePartPointerMove}
          onPointerOver={handlePartPointerOver}
          onClick={handlePartClick}
        >
          <CarBody />
        </group>
      </Suspense>
    </>
  )
}
