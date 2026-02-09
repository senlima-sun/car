import { useRef } from 'react'
import { Group, DirectionalLight, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { GROUND_COLLISION_GROUPS } from '../../constants/dimensions'
import Car from './Car/Car'
import CameraController from './Camera/CameraController'
import TrackTemperatureOverlay from './Track/TrackTemperatureOverlay'
import DistanceGridOverlay from './Track/DistanceGridOverlay'
import WindVisualization from './Weather/WindVisualization'
import WeatherEffects from './Weather/WeatherEffects'
import WindshieldRain from './Weather/WindshieldRain'
import LightningEffect from './Weather/LightningEffect'
import { ObjectPlacer, GhostPreview, PlacedObjectsRenderer, ValidationOverlay, ElevationGrid, ElevationHandles } from './Customization'
import TerrainMesh from './Track/TerrainMesh'
import StartGrid from './TrackObjects/StartGrid'
import { useGameStore } from '@/stores/useGameStore'
import { useEditorStore } from '@/stores/useEditorStore'

function Ground() {
  return (
    <>
      <RigidBody type='fixed' colliders={false}>
        <CuboidCollider
          args={[2500, 0.1, 2500]}
          position={[0, -0.12, 0]}
          friction={0.4}
          collisionGroups={GROUND_COLLISION_GROUPS}
        />
      </RigidBody>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[5000, 5000]} />
        <meshStandardMaterial color='#b0b0b0' roughness={0.8} />
      </mesh>
      <TerrainMesh />
    </>
  )
}

function FollowingSun({ target }: { target: React.RefObject<Group | null> }) {
  const lightRef = useRef<DirectionalLight>(null)
  const worldPos = useRef(new Vector3())
  const isCustomizeMode = useGameStore(s => s.status) === 'customize'

  useFrame(() => {
    if (!lightRef.current || !target.current) return

    target.current.getWorldPosition(worldPos.current)
    const carPos = worldPos.current

    lightRef.current.position.set(carPos.x - 30, 50, carPos.z + 15)
    lightRef.current.target.position.set(carPos.x, 0, carPos.z)
    lightRef.current.target.updateMatrixWorld()
  })

  const shadowSize = isCustomizeMode ? 2048 : 4096

  return (
    <directionalLight
      ref={lightRef}
      position={[0, 50, 0]}
      intensity={3}
      castShadow={!isCustomizeMode}
      shadow-mapSize={[shadowSize, shadowSize]}
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
      shadow-camera-near={0.5}
      shadow-camera-far={100}
      shadow-bias={-0.0005}
    />
  )
}

export default function Scene() {
  const carRef = useRef<Group>(null)
  const status = useGameStore(state => state.status)
  const isCustomizeMode = status === 'customize'
  const elevationEditMode = useEditorStore(s => s.elevationEditMode)

  return (
    <>
      {/* Sun that follows car */}
      <FollowingSun target={carRef} />

      {/* Ground */}
      <Ground />

      {/* Placed objects (roads, barriers, etc.) - always visible */}
      <PlacedObjectsRenderer />

      {/* Start grid behind start-finish line */}
      <StartGrid />

      {isCustomizeMode && (
        <>
          <ObjectPlacer />
          <GhostPreview />
          <ValidationOverlay />
          <ElevationGrid visible={elevationEditMode} />
          {elevationEditMode && <ElevationHandles />}
        </>
      )}

      {/* Track temperature overlay (press H to toggle) */}
      <TrackTemperatureOverlay />

      {/* Distance grid overlay (press Option/Alt to toggle) */}
      <DistanceGridOverlay />

      {/* Wind visualization (press H to toggle) */}
      <WindVisualization />

      {/* Weather effects (rain, snow, fog, puddles) */}
      <WeatherEffects />

      {/* First-person rain effects */}
      <WindshieldRain />
      <LightningEffect />

      {/* Car + camera */}
      <Car ref={carRef} />
      <CameraController target={carRef} />
    </>
  )
}
