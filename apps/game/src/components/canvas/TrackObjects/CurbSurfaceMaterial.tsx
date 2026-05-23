import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import {
  CURB_VERTEX_PREAMBLE,
  CURB_VERTEX_MAIN,
  CURB_FRAGMENT_PREAMBLE,
  CURB_COLOR_INJECT,
  CURB_ROUGHNESS_INJECT,
  CURB_METALNESS_INJECT,
  CURB_NORMAL_INJECT,
  createCurbUniforms,
} from '../../../shaders/curbSurface'
import { STRIPE_WIDTH, TOOTH_SPACING } from '../../../constants/curb'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { GHOST_OPACITY } from '../../../constants/trackObjects'
import { TRACK_LAYER_POLYGON_OFFSETS } from '../../../constants/trackLayers'
import type { CurbType } from '../../../types/trackObjects'

const weatherState = { rainIntensity: 0, temperature: 25 }
useEnvironmentStore.subscribe(state => {
  weatherState.rainIntensity = state.rainIntensity
  weatherState.temperature = state.temperature
})

const CURB_TYPE_MAP: Record<CurbType, number> = { apex: 0, exit: 1, flat: 2 }

interface CurbSurfaceMaterialProps {
  curbType: CurbType
  isGhost?: boolean
}

export default function CurbSurfaceMaterial({
  curbType,
  isGhost = false,
}: CurbSurfaceMaterialProps) {
  const uniformsRef = useRef(createCurbUniforms())

  const onBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uCurbType = uniformsRef.current.uCurbType
    shader.uniforms.uRainIntensity = uniformsRef.current.uRainIntensity
    shader.uniforms.uTemperature = uniformsRef.current.uTemperature
    shader.uniforms.uStripeWidth = uniformsRef.current.uStripeWidth
    shader.uniforms.uToothSpacing = uniformsRef.current.uToothSpacing
    shader.uniforms.uPrimaryColor = uniformsRef.current.uPrimaryColor
    shader.uniforms.uSecondaryColor = uniformsRef.current.uSecondaryColor

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\n${CURB_VERTEX_PREAMBLE}`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>\n${CURB_VERTEX_MAIN}`,
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${CURB_FRAGMENT_PREAMBLE}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>\n${CURB_COLOR_INJECT}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>\n${CURB_ROUGHNESS_INJECT}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>\n${CURB_METALNESS_INJECT}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>\n${CURB_NORMAL_INJECT}`,
    )
  }, [])

  uniformsRef.current.uCurbType.value = CURB_TYPE_MAP[curbType]
  uniformsRef.current.uRainIntensity.value = weatherState.rainIntensity
  uniformsRef.current.uTemperature.value = weatherState.temperature
  uniformsRef.current.uStripeWidth.value = STRIPE_WIDTH
  uniformsRef.current.uToothSpacing.value = TOOTH_SPACING

  if (isGhost) {
    return (
      <meshStandardMaterial
        color='#cc4444'
        transparent
        opacity={GHOST_OPACITY}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    )
  }

  return (
    <meshStandardMaterial
      color='#ffffff'
      roughness={0.75}
      metalness={0.0}
      side={THREE.DoubleSide}
      polygonOffset
      polygonOffsetFactor={TRACK_LAYER_POLYGON_OFFSETS.CURB.factor}
      polygonOffsetUnits={TRACK_LAYER_POLYGON_OFFSETS.CURB.units}
      onBeforeCompile={onBeforeCompile}
      ref={(mat: THREE.MeshStandardMaterial | null) => {
        if (mat) {
          mat.customProgramCacheKey = () => `curb-pbr-${curbType}`
        }
      }}
    />
  )
}
