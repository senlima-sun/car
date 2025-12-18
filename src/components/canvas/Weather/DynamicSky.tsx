import { useMemo } from 'react'
import { Sky } from '@react-three/drei'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { ATMOSPHERE_CONFIG, AtmosphereConfig } from '../../../constants/weather'

// Linear interpolation helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Interpolate atmosphere config values
function lerpAtmosphere(from: AtmosphereConfig, to: AtmosphereConfig, t: number): AtmosphereConfig {
  return {
    skyTurbidity: lerp(from.skyTurbidity, to.skyTurbidity, t),
    skyRayleigh: lerp(from.skyRayleigh, to.skyRayleigh, t),
    skyMieCoefficient: lerp(from.skyMieCoefficient, to.skyMieCoefficient, t),
    skyMieDirectionalG: lerp(from.skyMieDirectionalG, to.skyMieDirectionalG, t),
    sunPosition: [
      lerp(from.sunPosition[0], to.sunPosition[0], t),
      lerp(from.sunPosition[1], to.sunPosition[1], t),
      lerp(from.sunPosition[2], to.sunPosition[2], t),
    ],
    ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity, t),
    sunIntensity: lerp(from.sunIntensity, to.sunIntensity, t),
    sunColor: to.sunColor,
    fillLightIntensity: lerp(from.fillLightIntensity, to.fillLightIntensity, t),
    fillLightColor: to.fillLightColor,
    hemisphereIntensity: lerp(from.hemisphereIntensity, to.hemisphereIntensity, t),
    hemisphereSkyColor: to.hemisphereSkyColor,
    hemisphereGroundColor: to.hemisphereGroundColor,
    fogColor: to.fogColor,
    fogNear: lerp(from.fogNear, to.fogNear, t),
    fogFar: lerp(from.fogFar, to.fogFar, t),
  }
}

// Compute atmosphere based on dynamic temperature and rain
function computeAtmosphereFromDynamic(
  temperature: number,
  rainIntensity: number,
): AtmosphereConfig {
  // Determine base atmosphere from temperature
  let baseConfig = ATMOSPHERE_CONFIG.dry
  let blendTarget: AtmosphereConfig | null = null
  let blendFactor = 0

  if (temperature < 0) {
    // Cold zone: blend from cold to dry as temp increases
    baseConfig = ATMOSPHERE_CONFIG.cold
    // At -10C = full cold, at 0C = blend toward dry
    blendTarget = ATMOSPHERE_CONFIG.dry
    blendFactor = Math.max(0, (temperature + 10) / 10) // -10 -> 0 maps to 0 -> 1
  } else if (temperature > 35) {
    // Hot zone: blend from dry to hot as temp increases
    baseConfig = ATMOSPHERE_CONFIG.dry
    blendTarget = ATMOSPHERE_CONFIG.hot
    blendFactor = Math.min(1, (temperature - 35) / 15) // 35 -> 50 maps to 0 -> 1
  }

  // Apply temperature-based blending
  let result = blendTarget ? lerpAtmosphere(baseConfig, blendTarget, blendFactor) : baseConfig

  // Apply rain blending on top
  if (rainIntensity > 0.01) {
    result = lerpAtmosphere(result, ATMOSPHERE_CONFIG.rain, rainIntensity)
  }

  return result
}

export default function DynamicSky() {
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const atmosphere = useMemo(() => {
    return computeAtmosphereFromDynamic(temperature, rainIntensity)
  }, [temperature, rainIntensity])

  return (
    <Sky
      distance={450000}
      sunPosition={atmosphere.sunPosition}
      turbidity={atmosphere.skyTurbidity}
      rayleigh={atmosphere.skyRayleigh}
      mieCoefficient={atmosphere.skyMieCoefficient}
      mieDirectionalG={atmosphere.skyMieDirectionalG}
    />
  )
}

// Export the lerp functions for use in other components
export { lerp, lerpAtmosphere, computeAtmosphereFromDynamic }
