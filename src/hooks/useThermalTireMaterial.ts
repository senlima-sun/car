import { useMemo } from 'react'
import * as THREE from 'three'
import { thermalVertexShader, thermalFragmentShader, TEMP_SCALES } from '../shaders/thermalView'

// Thermal material for tires - created once and uniforms updated
// Uses unified Celsius-based temperature colors
export function useThermalTireMaterial(temperature: number) {
  const uniforms = useMemo(
    () => ({
      temperature: { value: temperature },
      tempMin: { value: TEMP_SCALES.tire.min },
      tempRange: { value: TEMP_SCALES.tire.range },
    }),
    [],
  )

  // Update temperature uniform
  uniforms.temperature.value = temperature

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: thermalVertexShader,
        fragmentShader: thermalFragmentShader,
        uniforms,
      }),
    [uniforms],
  )

  return material
}
