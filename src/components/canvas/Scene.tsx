import { useRef, useMemo } from 'react'
import { Group, DoubleSide } from 'three'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { GROUND_COLLISION_GROUPS } from '../../constants/dimensions'
import { grassFragmentShader, createGrassUniforms } from '@/shaders/grassSurface'
import Car from './Car/Car'
import CameraController from './Camera/CameraController'
import TrackTemperatureOverlay from './Track/TrackTemperatureOverlay'
import DistanceGridOverlay from './Track/DistanceGridOverlay'
import WindVisualization from './Weather/WindVisualization'
import WeatherEffects from './Weather/WeatherEffects'
import WindshieldRain from './Weather/WindshieldRain'
import LightningEffect from './Weather/LightningEffect'
import DynamicSky from './Weather/DynamicSky'
import DynamicLighting from './Weather/DynamicLighting'
import CloudLayer from './Weather/CloudLayer'
import { ObjectPlacer, GhostPreview, PlacedObjectsRenderer, ValidationOverlay, ElevationGrid, ElevationHandles } from './Customization'
import TerrainMesh from './Track/TerrainMesh'
import StartGrid from './TrackObjects/StartGrid'
import SurfaceParticles from './TrackObjects/SurfaceParticles'
import { useGameStore } from '@/stores/useGameStore'
import { useEditorStore } from '@/stores/useEditorStore'

const groundVertexShader = /* glsl */ `
varying vec3 vWorldPos;
varying float vEdgeDist;
varying vec3 vNormal;

void main() {
  vEdgeDist = 1.0;
  vNormal = normalize(normalMatrix * normal);

  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

function Ground() {
  const uniforms = useMemo(() => createGrassUniforms(), [])
  const materialRef = useRef<{ uniforms: { uTime: { value: number } } }>(null)

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta
    }
  })

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
        <shaderMaterial
          ref={materialRef as any}
          vertexShader={groundVertexShader}
          fragmentShader={grassFragmentShader}
          uniforms={uniforms}
          side={DoubleSide}
        />
      </mesh>
      <TerrainMesh />
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
      {/* Dynamic sky dome */}
      <DynamicSky />

      {/* Weather-responsive lighting with car-following shadows */}
      <DynamicLighting target={carRef} />

      {/* Cloud layer */}
      <CloudLayer />

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

      {/* Surface debris particles (gravel/grass) */}
      <SurfaceParticles />

      {/* Car + camera */}
      <Car ref={carRef} />
      <CameraController target={carRef} />
    </>
  )
}
