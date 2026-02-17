import { Suspense, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { Group } from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { GROUND_COLLISION_GROUPS } from '../../constants/dimensions'
import {
  GRASS_VERTEX_PREAMBLE,
  GRASS_VERTEX_DISPLACEMENT,
  GRASS_VERTEX_WORLDPOS_INJECT,
  GRASS_FRAGMENT_PREAMBLE,
  GRASS_COLOR_INJECT,
  GRASS_ROUGHNESS_INJECT,
} from '@/shaders/grassSurface'
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
import {
  ObjectPlacer,
  GhostPreview,
  PlacedObjectsRenderer,
  ValidationOverlay,
  ElevationGrid,
  ElevationHandles,
  CheckpointHandles,
  WallHandles,
} from './Customization'
import TerrainMesh from './Track/TerrainMesh'
import StartGrid from './TrackObjects/StartGrid'
import SurfaceParticles from './TrackObjects/SurfaceParticles'
import { useGameStore } from '@/stores/useGameStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { usePerformanceStore, type QualityTier } from '@/stores/usePerformanceStore'

const GROUND_SUBDIVISIONS: Record<QualityTier, number> = {
  ultra: 256,
  high: 128,
  medium: 64,
  low: 32,
}

function Ground({ simplified }: { simplified?: boolean }) {
  const tier = usePerformanceStore(s => s.tier)
  const subdivisions = simplified ? 1 : GROUND_SUBDIVISIONS[tier]

  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    if (simplified) return
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${GRASS_VERTEX_PREAMBLE}\n${GRASS_VERTEX_WORLDPOS_INJECT}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${GRASS_VERTEX_DISPLACEMENT}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>\nvGrassWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${GRASS_FRAGMENT_PREAMBLE}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n${GRASS_COLOR_INJECT}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>\n${GRASS_ROUGHNESS_INJECT}`,
    )
  }, [simplified])

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
      <mesh key={`ground-${subdivisions}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[5000, 5000, subdivisions, subdivisions]} />
        {simplified ? (
          <meshStandardMaterial roughness={0.9} color='#88aa66' />
        ) : (
          <meshStandardMaterial
            roughness={0.9}
            color='#88aa66'
            onBeforeCompile={onBeforeCompile}
            ref={(mat: THREE.MeshStandardMaterial | null) => {
              if (mat) mat.customProgramCacheKey = () => 'grass-procedural'
            }}
          />
        )}
      </mesh>
      {!simplified && <TerrainMesh />}
    </>
  )
}

export default function Scene() {
  const carRef = useRef<Group>(null)
  const status = useGameStore(state => state.status)
  const isCustomizeMode = status === 'customize'
  const elevationEditMode = useEditorStore(s => s.elevationEditMode)

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

      <Ground simplified={isCustomizeMode} />
      <PlacedObjectsRenderer />
      <StartGrid />

      {isCustomizeMode && (
        <>
          <ObjectPlacer />
          <GhostPreview />
          <ValidationOverlay />
          <ElevationGrid visible={elevationEditMode} />
          {elevationEditMode && <ElevationHandles />}
          <CheckpointHandles />
          <WallHandles />
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
