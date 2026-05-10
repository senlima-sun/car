import { useRef } from 'react'
import { Group } from 'three'
import Car from './Car/Car'
import MouseInputManager from './MouseInputManager'
import { GhostCar } from './GhostCar'
import CameraController from './Camera/CameraController'
import RacingLine from './Track/RacingLine'
import WindVisualization from './Weather/WindVisualization'
import WeatherEffects from './Weather/WeatherEffects'
import WindshieldRain from './Weather/WindshieldRain'
import LightningEffect from './Weather/LightningEffect'
import DynamicLighting from './Weather/DynamicLighting'
import SkyDome from './Weather/SkyDome'
import VolumetricClouds from './Weather/VolumetricClouds'
import WeatherMirror from './Weather/WeatherMirror'
import WeatherSourcesProvider from './Weather/WeatherSourcesProvider'
import JumpStartDetector from './JumpStartDetector'
import {
  PlacedObjectsRenderer,
  ObjectPlacer,
  CheckpointHandles,
  WallHandles,
} from './Customization'
import { TerrainGround } from './Terrain'
import StartGrid from './TrackObjects/StartGrid'
import SurfaceParticles from './TrackObjects/SurfaceParticles'
import {
  isCustomizeStatus,
  isMenuStatus,
  isPreviewStatus,
  useGameStore,
} from '@/stores/useGameStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTrackStore } from '@/stores/useTrackStore'
import PreviewScene from './Preview/PreviewScene'

export default function Scene() {
  const carRef = useRef<Group>(null)
  const status = useGameStore(state => state.status)
  const isMenuMode = isMenuStatus(status)
  const isCustomizeMode = isCustomizeStatus(status)
  const isPreviewMode = isPreviewStatus(status)
  const terrainEditMode = useEditorStore(s => s.editorMode === 'terrain')
  const activeTrackId = useTrackStore(s => s.trackLibrary.activeTrackId)

  if (isMenuMode || isPreviewMode) return <PreviewScene />

  return (
    <>
      <DynamicLighting target={carRef} />
      <SkyDome />
      <VolumetricClouds />

      {isCustomizeMode && <fog attach='fog' args={['#e8e8e8', 5000, 10000]} />}

      <TerrainGround
        simplified={isCustomizeMode && !terrainEditMode}
        interactive={isCustomizeMode && terrainEditMode}
      />
      <PlacedObjectsRenderer />
      <StartGrid />

      {isCustomizeMode && (
        <>
          <ObjectPlacer />
          <CheckpointHandles />
          <WallHandles />
        </>
      )}

      {!isCustomizeMode && (
        <>
          <RacingLine />
          <WindVisualization />
          <WeatherEffects />
          <WindshieldRain />
          <LightningEffect />
          <WeatherMirror />
          <WeatherSourcesProvider />
          <JumpStartDetector />
          <SurfaceParticles />
          <Car key={activeTrackId ?? 'default'} ref={carRef} />
          <MouseInputManager />
          <GhostCar />
        </>
      )}

      <CameraController target={carRef} />
    </>
  )
}
