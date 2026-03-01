import { Suspense, useRef } from 'react'
import { Group } from 'three'
import Car from './Car/Car'
import MouseInputManager from './MouseInputManager'
import { GhostCar } from './GhostCar'
import CameraController from './Camera/CameraController'
import TrackTemperatureOverlay from './Track/TrackTemperatureOverlay'
import SkidMarkRenderer from './Track/SkidMarkRenderer'
import RacingLine from './Track/RacingLine'
import WindVisualization from './Weather/WindVisualization'
import WeatherEffects from './Weather/WeatherEffects'
import WindshieldRain from './Weather/WindshieldRain'
import LightningEffect from './Weather/LightningEffect'
import DynamicSky from './Weather/DynamicSky'
import DynamicLighting from './Weather/DynamicLighting'
import { PlacedObjectsRenderer, ObjectPlacer, CheckpointHandles, WallHandles } from './Customization'
import { TerrainGround, TerrainBrushInteraction, TerrainBrushIndicator } from './Terrain'
import StartGrid from './TrackObjects/StartGrid'
import SurfaceParticles from './TrackObjects/SurfaceParticles'
import { useGameStore } from '@/stores/useGameStore'
import { useEditorStore } from '@/stores/useEditorStore'
import PreviewScene from './Preview/PreviewScene'

export default function Scene() {
  const carRef = useRef<Group>(null)
  const status = useGameStore(state => state.status)
  const isCustomizeMode = status === 'customize'
  const isPreviewMode = status === 'preview'
  const terrainEditMode = useEditorStore(s => s.terrainEditMode)

  if (isPreviewMode) return <PreviewScene />

  return (
    <>
      {!isCustomizeMode && (
        <Suspense fallback={null}>
          <DynamicSky />
        </Suspense>
      )}
      <DynamicLighting target={carRef} />

      {isCustomizeMode && (
        <fog attach='fog' args={['#e8e8e8', 5000, 10000]} />
      )}

      <TerrainGround simplified={isCustomizeMode && !terrainEditMode} />
      <PlacedObjectsRenderer />
      <StartGrid />

      {isCustomizeMode && (
        <>
          <ObjectPlacer />
          <CheckpointHandles />
          <WallHandles />
        </>
      )}

      {isCustomizeMode && terrainEditMode && (
        <>
          <TerrainBrushInteraction />
          <TerrainBrushIndicator />
        </>
      )}

      {!isCustomizeMode && (
        <>
          <TrackTemperatureOverlay />
          <SkidMarkRenderer />
          <RacingLine />
          <WindVisualization />
          <WeatherEffects />
          <WindshieldRain />
          <LightningEffect />
          <SurfaceParticles />
          <Car ref={carRef} />
          <MouseInputManager />
          <GhostCar />
        </>
      )}

      <CameraController target={carRef} />
    </>
  )
}
