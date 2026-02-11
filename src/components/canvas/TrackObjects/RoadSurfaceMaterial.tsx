import { useCallback, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import {
  ASPHALT_FRAGMENT_INJECT,
  ASPHALT_VERTEX_INJECT,
  ASPHALT_VERTEX_WORLDPOS_INJECT,
  ASPHALT_COLOR_INJECT,
  ASPHALT_PIT_COLOR_INJECT,
  createAsphaltUniforms,
} from '../../../shaders/asphaltSurface'
import { GHOST_OPACITY } from '../../../constants/trackObjects'

interface RoadSurfaceMaterialProps {
  isGhost?: boolean
  variant?: 'road' | 'pitroad'
  wetness?: number
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
  wetness = 0,
  skidMarkTexture = null,
  skidMarkBounds,
  transparent,
  opacity,
  depthWrite,
  side,
  polygonOffset = true,
  polygonOffsetFactor = -1,
  polygonOffsetUnits = -1,
  color,
}: RoadSurfaceMaterialProps) {
  const [normalMap, roughnessMap] = useLoader(THREE.TextureLoader, [
    '/textures/asphalt_normal.jpg',
    '/textures/asphalt_roughness.jpg',
  ])

  useMemo(() => {
    for (const tex of [normalMap, roughnessMap]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.repeat.set(4, 4)
    }
  }, [normalMap, roughnessMap])

  const uniformsRef = useRef(createAsphaltUniforms())

  const onBeforeCompile = useCallback(
    (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uWetness = uniformsRef.current.uWetness
      shader.uniforms.uSkidMarkMap = uniformsRef.current.uSkidMarkMap
      shader.uniforms.uSkidMarkBounds = uniformsRef.current.uSkidMarkBounds

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${ASPHALT_VERTEX_INJECT}`,
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>\n${ASPHALT_VERTEX_WORLDPOS_INJECT}`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>\n${ASPHALT_FRAGMENT_INJECT}`,
      )

      const colorInject = variant === 'pitroad' ? ASPHALT_PIT_COLOR_INJECT : ASPHALT_COLOR_INJECT
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n${colorInject}`,
      )
    },
    [variant],
  )

  uniformsRef.current.uWetness.value = wetness
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
      color={color ?? (variant === 'pitroad' ? '#3a3a3a' : '#4a4a4a')}
      transparent={transparent ?? false}
      opacity={opacity ?? 1}
      depthWrite={depthWrite ?? true}
      side={side}
      roughness={0.85}
      normalMap={normalMap}
      normalScale={new THREE.Vector2(0.6, 0.6)}
      roughnessMap={roughnessMap}
      polygonOffset={polygonOffset}
      polygonOffsetFactor={polygonOffsetFactor}
      polygonOffsetUnits={polygonOffsetUnits}
      onBeforeCompile={onBeforeCompile}
    />
  )
}
