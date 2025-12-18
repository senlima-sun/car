import { useMemo } from 'react'
import * as THREE from 'three'
import { useTemperatureStore } from '../../../../stores/useTemperatureStore'
import {
  thermalVertexShader,
  engineThermalFragmentShader,
  TEMP_SCALES,
} from '../../../../shaders/thermalView'

/**
 * Hook to create and manage engine thermal shader material
 * Returns the thermal material and current engine temperature
 * Uses unified Celsius-based temperature colors
 */
export function useEngineThermal() {
  const engineTemp = useTemperatureStore(state => state.engine)

  // Engine thermal uniforms with Celsius conversion
  const engineThermalUniforms = useMemo(
    () => ({
      temperature: { value: engineTemp.temperature },
      tempMin: { value: TEMP_SCALES.engine.min },
      tempRange: { value: TEMP_SCALES.engine.range },
    }),
    [],
  )

  // Update temperature value each render
  engineThermalUniforms.temperature.value = engineTemp.temperature

  // Create thermal shader material
  const engineThermalMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: thermalVertexShader,
        fragmentShader: engineThermalFragmentShader,
        uniforms: engineThermalUniforms,
      }),
    [engineThermalUniforms],
  )

  return {
    engineThermalMaterial,
    engineTemp,
  }
}
