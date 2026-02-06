import { useRef } from 'react'
import { Group, DirectionalLight, Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import Car from './Car/Car'
import CameraController from './Camera/CameraController'
import TrackTemperatureOverlay from './Track/TrackTemperatureOverlay'
import DistanceGridOverlay from './Track/DistanceGridOverlay'
import WindVisualization from './Weather/WindVisualization'
import WeatherEffects from './Weather/WeatherEffects'
import WindshieldRain from './Weather/WindshieldRain'
import LightningEffect from './Weather/LightningEffect'
import { ObjectPlacer, GhostPreview, PlacedObjectsRenderer, ValidationOverlay } from './Customization'
import PitLane from './TrackObjects/PitLane'
import StartGrid from './TrackObjects/StartGrid'
import { useGameStore } from '@/stores/useGameStore'
import { usePitStore } from '@/stores/usePitStore'

function Ground() {
  return (
    <RigidBody type='fixed' colliders='cuboid' friction={1}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial color='#808080' roughness={0.3} metalness={0} />
      </mesh>
    </RigidBody>
  )
}

function FollowingSun({ target }: { target: React.RefObject<Group | null> }) {
  const lightRef = useRef<DirectionalLight>(null)
  const worldPos = useRef(new Vector3())

  useFrame(() => {
    if (!lightRef.current || !target.current) return

    // Get world position of the car
    target.current.getWorldPosition(worldPos.current)
    const carPos = worldPos.current

    // Light at 10-11 o'clock angle (offset to left-front)
    lightRef.current.position.set(carPos.x - 30, 50, carPos.z + 15)
    // Light target follows car
    lightRef.current.target.position.set(carPos.x, 0, carPos.z)
    lightRef.current.target.updateMatrixWorld()
  })

  return (
    <directionalLight
      ref={lightRef}
      position={[0, 50, 0]}
      intensity={3}
      castShadow
      shadow-mapSize={[4096, 4096]}
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
  const pitLaneData = usePitStore(s => s.pitLaneData)

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

      {/* Pit lane (generated from checkpoint) */}
      {pitLaneData && <PitLane data={pitLaneData} />}

      {/* Customization components - only in edit mode */}
      {isCustomizeMode && (
        <>
          <ObjectPlacer />
          <GhostPreview />
          <ValidationOverlay />
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
