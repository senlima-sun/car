import { useRef, useEffect } from 'react'
import { Group } from 'three'
import { Environment } from '@react-three/drei'
import { useGameStore } from '../../stores/useGameStore'
import { usePitStore } from '../../stores/usePitStore'
import { useLapTimeStore } from '../../stores/useLapTimeStore'
import { useCustomizationStore } from '../../stores/useCustomizationStore'
import Car from './Car/Car'
import RaceTrack from './Track/RaceTrack'
import CameraController from './Camera/CameraController'
import IsometricCamera from './Camera/IsometricCamera'
import { ObjectPlacer, PlacedObjectsRenderer } from './Customization'
import WeatherEffects from './Weather/WeatherEffects'
import DynamicSky from './Weather/DynamicSky'
import DynamicClouds from './Weather/DynamicClouds'
import DynamicLighting from './Weather/DynamicLighting'
import TrackTemperatureOverlay from './Track/TrackTemperatureOverlay'
import PitLane from './TrackObjects/PitLane'
import FPSMonitor from './FPSMonitor'

export default function Scene() {
  const carRef = useRef<Group>(null)
  const status = useGameStore(s => s.status)
  const pitLaneData = usePitStore(s => s.pitLaneData)
  const isCustomizeMode = status === 'customize'

  // Lap time activation based on checkpoint existence
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const setLapTimeActive = useLapTimeStore(s => s.setActive)

  useEffect(() => {
    const hasCheckpoint = placedObjects.some(obj => obj.type === 'checkpoint')
    setLapTimeActive(hasCheckpoint)
  }, [placedObjects, setLapTimeActive])

  return (
    <>
      {/* FPS Monitor - updates FPS store */}
      <FPSMonitor />

      {/* Environment map for reflections on metallic surfaces */}
      <Environment preset='city' />

      {/* Dynamic procedural sky - responds to weather */}
      <DynamicSky />

      {/* Dynamic clouds - count and opacity change with weather */}
      <DynamicClouds />

      {/* Dynamic lighting - intensity and colors change with weather */}
      <DynamicLighting />

      {/* Weather effects (includes dynamic fog, surface effects) */}
      <WeatherEffects />

      {/* Track temperature overlay (tire traces, heat visualization) */}
      <TrackTemperatureOverlay />

      {/* Track */}
      <RaceTrack />

      {/* Placed objects - always rendered */}
      <PlacedObjectsRenderer enablePhysics={!isCustomizeMode} />

      {/* Pit Lane - render when generated */}
      {pitLaneData && <PitLane data={pitLaneData} isGhost={isCustomizeMode} />}

      {isCustomizeMode ? (
        <>
          {/* Customize mode: isometric camera + object placer */}
          <IsometricCamera />
          <ObjectPlacer />
        </>
      ) : (
        <>
          {/* Race mode: car + chase camera */}
          <Car ref={carRef} />
          <CameraController target={carRef} />
        </>
      )}
    </>
  )
}
