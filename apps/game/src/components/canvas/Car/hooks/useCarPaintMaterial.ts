import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import {
  CAR_PAINT_VERTEX_INJECT,
  CAR_PAINT_VERTEX_WORLDPOS_INJECT,
  CAR_PAINT_FRAGMENT_INJECT,
  CAR_PAINT_COLOR_INJECT,
  CAR_PAINT_ROUGHNESS_INJECT,
  CAR_PAINT_METALNESS_INJECT,
  createCarPaintUniforms,
} from '../../../../shaders/carPaint'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import {
  useCarPaintStore,
  getPartIdForMesh,
  DEFAULT_PART_MATERIAL_SETTINGS,
  type CarPartId,
} from '../../../../stores/useCarPaintStore'

const weatherState = { rainIntensity: 0 }
const paintState = {
  partColors: {} as ReturnType<typeof useCarPaintStore.getState>['partColors'],
  partMaterialSettings:
    {} as ReturnType<typeof useCarPaintStore.getState>['partMaterialSettings'],
  flakeIntensity: 0,
  flakeScale: 0,
  clearcoatStrength: 0,
  colorDepthFactor: 0,
}

let subscriptionsInitialized = false

function ensureSubscriptions() {
  if (subscriptionsInitialized) return
  subscriptionsInitialized = true

  const env = useEnvironmentStore.getState()
  weatherState.rainIntensity = env.rainIntensity
  useEnvironmentStore.subscribe(state => {
    weatherState.rainIntensity = state.rainIntensity
  })

  const initPaint = useCarPaintStore.getState()
  paintState.partColors = initPaint.partColors
  paintState.partMaterialSettings = initPaint.partMaterialSettings
  paintState.flakeIntensity = initPaint.flakeIntensity
  paintState.flakeScale = initPaint.flakeScale
  paintState.clearcoatStrength = initPaint.clearcoatStrength
  paintState.colorDepthFactor = initPaint.colorDepthFactor

  // TODO(tech-debt): module-level subscriptions never unsubscribe. Safe today
  // because multiple BodyFrame instances (main + Preview) share paintState; a
  // useEffect-scoped subscription would tear down on first unmount and break
  // the remaining consumers. Revisit when paintState is per-instance.
  useCarPaintStore.subscribe(state => {
    paintState.partColors = state.partColors
    paintState.partMaterialSettings = state.partMaterialSettings
    paintState.flakeIntensity = state.flakeIntensity
    paintState.flakeScale = state.flakeScale
    paintState.clearcoatStrength = state.clearcoatStrength
    paintState.colorDepthFactor = state.colorDepthFactor
  })
}

const _tmpColor = new THREE.Color()

export function useCarPaintMaterial() {
  ensureSubscriptions()
  const uniformsRef = useRef(createCarPaintUniforms())
  const partMaterialsRef = useRef<Map<CarPartId, THREE.MeshStandardMaterial[]>>(new Map())

  const applyCarPaint = useCallback((material: THREE.MeshStandardMaterial, meshName: string) => {
    const partId = getPartIdForMesh(meshName)
    const materialSettings = partId
      ? (paintState.partMaterialSettings[partId] ?? DEFAULT_PART_MATERIAL_SETTINGS)
      : DEFAULT_PART_MATERIAL_SETTINGS

    material.roughness = materialSettings.roughness
    material.metalness = materialSettings.metalness
    material.envMapIntensity = 1.2

    if (partId) {
      material.color.set(paintState.partColors[partId] ?? '#0a1128')
      const list = partMaterialsRef.current.get(partId) ?? []
      list.push(material)
      partMaterialsRef.current.set(partId, list)
    }

    material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
      const u = uniformsRef.current
      shader.uniforms.uRainIntensity = u.uRainIntensity
      shader.uniforms.uFlakeScale = u.uFlakeScale
      shader.uniforms.uFlakeIntensity = u.uFlakeIntensity
      shader.uniforms.uClearcoatStrength = u.uClearcoatStrength
      shader.uniforms.uColorDepthFactor = u.uColorDepthFactor
      shader.uniforms.uCameraDistance = u.uCameraDistance

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${CAR_PAINT_VERTEX_INJECT}`,
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>\n${CAR_PAINT_VERTEX_WORLDPOS_INJECT}`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>\n${CAR_PAINT_FRAGMENT_INJECT}`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n${CAR_PAINT_COLOR_INJECT}`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n${CAR_PAINT_ROUGHNESS_INJECT}`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>\n${CAR_PAINT_METALNESS_INJECT}`,
      )
    }

    material.customProgramCacheKey = () => 'car-paint-pbr'
    material.needsUpdate = true
  }, [])

  const updateUniforms = useCallback((cameraDistance: number) => {
    const u = uniformsRef.current
    u.uRainIntensity.value = weatherState.rainIntensity
    u.uCameraDistance.value = cameraDistance
    u.uFlakeIntensity.value = paintState.flakeIntensity
    u.uFlakeScale.value = paintState.flakeScale
    u.uClearcoatStrength.value = paintState.clearcoatStrength
    u.uColorDepthFactor.value = paintState.colorDepthFactor

    for (const [partId, materials] of partMaterialsRef.current) {
      _tmpColor.set(paintState.partColors[partId] ?? '#0a1128')
      const materialSettings =
        paintState.partMaterialSettings[partId] ?? DEFAULT_PART_MATERIAL_SETTINGS
      for (const mat of materials) {
        if (!mat.color.equals(_tmpColor)) {
          mat.color.copy(_tmpColor)
        }
        if (mat.roughness !== materialSettings.roughness) {
          mat.roughness = materialSettings.roughness
        }
        if (mat.metalness !== materialSettings.metalness) {
          mat.metalness = materialSettings.metalness
        }
      }
    }
  }, [])

  return { applyCarPaint, updateUniforms }
}
