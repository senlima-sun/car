import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { assetUrl } from '@/utils/assetUrl'
import {
  ASPHALT_FRAGMENT_INJECT,
  ASPHALT_VERTEX_INJECT,
  ASPHALT_VERTEX_NOISE_PREAMBLE,
  ASPHALT_VERTEX_DISPLACEMENT,
  ASPHALT_VERTEX_WORLDPOS_INJECT,
  ASPHALT_COLOR_INJECT,
  ASPHALT_ROUGHNESS_INJECT,
  ASPHALT_METALNESS_INJECT,
  ASPHALT_NORMAL_INJECT,
  createAsphaltUniforms,
} from '../../../shaders/asphaltSurface'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { GHOST_OPACITY } from '../../../constants/trackObjects'
import { TRACK_LAYER_POLYGON_OFFSETS } from '../../../constants/trackLayers'

const weatherState = { rainIntensity: 0, temperature: 25 }
useEnvironmentStore.subscribe(state => {
  weatherState.rainIntensity = state.rainIntensity
  weatherState.temperature = state.temperature
})

function configureAsphaltTexture(texture: THREE.Texture, repeatX: number, repeatY: number) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
}

interface RoadSurfaceMaterialProps {
  isGhost?: boolean
  variant?: 'road' | 'pitroad'
  skidMarkTexture?: THREE.Texture | null
  skidMarkBounds?: THREE.Vector4
  transparent?: boolean
  opacity?: number
  depthWrite?: boolean
  side?: THREE.Side
  polygonOffset?: boolean
  polygonOffsetFactor?: number
  polygonOffsetUnits?: number
  color?: string
}

export default function RoadSurfaceMaterial({
  isGhost = false,
  variant = 'road',
  skidMarkTexture = null,
  skidMarkBounds,
  transparent,
  opacity,
  depthWrite,
  side,
  polygonOffset = true,
  polygonOffsetFactor = TRACK_LAYER_POLYGON_OFFSETS.ASPHALT.factor,
  polygonOffsetUnits = TRACK_LAYER_POLYGON_OFFSETS.ASPHALT.units,
  color,
}: RoadSurfaceMaterialProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const [
    asphaltBaseColorMap,
    asphaltWornColorMap,
    asphaltPitColorMap,
    asphaltNormalMap,
    asphaltRoughnessMap,
  ] = useTexture([
    assetUrl('/textures/asphalt_base_color.webp'),
    assetUrl('/textures/asphalt_worn_color.webp'),
    assetUrl('/textures/asphalt_pit_color.webp'),
    assetUrl('/textures/asphalt_base_normal.webp'),
    assetUrl('/textures/asphalt_base_roughness.webp'),
  ]) as THREE.Texture[]

  const uniformsRef = useRef(createAsphaltUniforms())

  asphaltBaseColorMap.colorSpace = THREE.SRGBColorSpace
  asphaltWornColorMap.colorSpace = THREE.SRGBColorSpace
  asphaltPitColorMap.colorSpace = THREE.SRGBColorSpace
  configureAsphaltTexture(asphaltBaseColorMap, 2.2, 7.5)
  configureAsphaltTexture(asphaltWornColorMap, 2.2, 7.5)
  configureAsphaltTexture(asphaltPitColorMap, 2.2, 7.5)
  configureAsphaltTexture(asphaltNormalMap, 2.2, 7.5)
  configureAsphaltTexture(asphaltRoughnessMap, 2.2, 7.5)

  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uRainIntensity = uniformsRef.current.uRainIntensity
    shader.uniforms.uTemperature = uniformsRef.current.uTemperature
    shader.uniforms.uPitDarken = uniformsRef.current.uPitDarken
    shader.uniforms.uRoadWearStrength = uniformsRef.current.uRoadWearStrength
    shader.uniforms.uAsphaltWornMap = uniformsRef.current.uAsphaltWornMap
    shader.uniforms.uSkidMarkMap = uniformsRef.current.uSkidMarkMap
    shader.uniforms.uSkidMarkBounds = uniformsRef.current.uSkidMarkBounds

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${ASPHALT_VERTEX_NOISE_PREAMBLE}\n${ASPHALT_VERTEX_INJECT}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${ASPHALT_VERTEX_DISPLACEMENT}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>\n${ASPHALT_VERTEX_WORLDPOS_INJECT}`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${ASPHALT_FRAGMENT_INJECT}`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n${ASPHALT_COLOR_INJECT}`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>\n${ASPHALT_ROUGHNESS_INJECT}`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>\n${ASPHALT_NORMAL_INJECT}`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>\n${ASPHALT_METALNESS_INJECT}`,
    )
  }, [])

  uniformsRef.current.uRainIntensity.value = weatherState.rainIntensity
  uniformsRef.current.uTemperature.value = weatherState.temperature
  uniformsRef.current.uPitDarken.value = variant === 'pitroad' ? 0.8 : 1.0
  uniformsRef.current.uRoadWearStrength.value = variant === 'pitroad' ? 0.0 : 1.0
  uniformsRef.current.uAsphaltWornMap.value = asphaltWornColorMap
  uniformsRef.current.uSkidMarkMap.value = skidMarkTexture
  if (skidMarkBounds) {
    uniformsRef.current.uSkidMarkBounds.value = skidMarkBounds
  }

  if (isGhost) {
    return (
      <meshStandardMaterial
        color={color ?? (variant === 'pitroad' ? '#3a3a3a' : '#4a4a4a')}
        transparent
        opacity={GHOST_OPACITY}
        depthWrite={false}
        polygonOffset={polygonOffset}
        polygonOffsetFactor={polygonOffsetFactor}
        polygonOffsetUnits={polygonOffsetUnits}
      />
    )
  }

  return (
    <meshStandardMaterial
      key={`asphalt-${variant}`}
      color={color ?? '#ffffff'}
      map={variant === 'pitroad' ? asphaltPitColorMap : asphaltBaseColorMap}
      transparent={transparent ?? false}
      opacity={opacity ?? 1}
      depthWrite={depthWrite ?? true}
      side={side}
      roughness={0.85}
      metalness={0.0}
      normalMap={asphaltNormalMap}
      normalScale={
        variant === 'pitroad' ? new THREE.Vector2(0.4, 0.4) : new THREE.Vector2(0.55, 0.55)
      }
      roughnessMap={asphaltRoughnessMap}
      polygonOffset={polygonOffset}
      polygonOffsetFactor={polygonOffsetFactor}
      polygonOffsetUnits={polygonOffsetUnits}
      onBeforeCompile={onBeforeCompile}
      ref={(mat: THREE.MeshStandardMaterial | null) => {
        if (mat) {
          matRef.current = mat
          mat.customProgramCacheKey = () => `asphalt-pbr-${variant}`
        }
      }}
    />
  )
}
