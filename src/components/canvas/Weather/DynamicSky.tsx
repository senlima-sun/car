import { useMemo } from 'react'
import { Sky } from '@react-three/drei'
import { useWeatherStore } from '../../../stores/useWeatherStore'
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
    cloudOpacity: lerp(from.cloudOpacity, to.cloudOpacity, t),
    cloudCount: Math.round(lerp(from.cloudCount, to.cloudCount, t)),
    cloudColor: to.cloudColor, // Use target color
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

export default function DynamicSky() {
  const currentWeather = useWeatherStore(s => s.currentWeather)
  const previousWeather = useWeatherStore(s => s.previousWeather)
  const transitionProgress = useWeatherStore(s => s.transitionProgress)
  const isTransitioning = useWeatherStore(s => s.isTransitioning)

  const atmosphere = useMemo(() => {
    if (!isTransitioning) {
      return ATMOSPHERE_CONFIG[currentWeather]
    }
    // Smoothstep easing for natural transition
    const easedProgress = transitionProgress * transitionProgress * (3 - 2 * transitionProgress)
    return lerpAtmosphere(
      ATMOSPHERE_CONFIG[previousWeather],
      ATMOSPHERE_CONFIG[currentWeather],
      easedProgress,
    )
  }, [currentWeather, previousWeather, transitionProgress, isTransitioning])

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
export { lerp, lerpAtmosphere }
