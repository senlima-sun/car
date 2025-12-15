import { useMemo } from 'react'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import { ATMOSPHERE_CONFIG } from '../../../constants/weather'
import { lerp } from './DynamicSky'

// Color interpolation helper
function lerpColor(from: string, to: string, t: number): string {
  // Parse hex colors
  const fromR = parseInt(from.slice(1, 3), 16)
  const fromG = parseInt(from.slice(3, 5), 16)
  const fromB = parseInt(from.slice(5, 7), 16)

  const toR = parseInt(to.slice(1, 3), 16)
  const toG = parseInt(to.slice(3, 5), 16)
  const toB = parseInt(to.slice(5, 7), 16)

  const r = Math.round(lerp(fromR, toR, t))
  const g = Math.round(lerp(fromG, toG, t))
  const b = Math.round(lerp(fromB, toB, t))

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default function DynamicLighting() {
  const currentWeather = useWeatherStore(s => s.currentWeather)
  const previousWeather = useWeatherStore(s => s.previousWeather)
  const transitionProgress = useWeatherStore(s => s.transitionProgress)
  const isTransitioning = useWeatherStore(s => s.isTransitioning)

  const config = useMemo(() => {
    if (!isTransitioning) {
      return ATMOSPHERE_CONFIG[currentWeather]
    }

    const from = ATMOSPHERE_CONFIG[previousWeather]
    const to = ATMOSPHERE_CONFIG[currentWeather]
    // Smoothstep easing
    const easedProgress = transitionProgress * transitionProgress * (3 - 2 * transitionProgress)

    return {
      ...to,
      ambientIntensity: lerp(from.ambientIntensity, to.ambientIntensity, easedProgress),
      sunIntensity: lerp(from.sunIntensity, to.sunIntensity, easedProgress),
      sunColor: lerpColor(from.sunColor, to.sunColor, easedProgress),
      fillLightIntensity: lerp(from.fillLightIntensity, to.fillLightIntensity, easedProgress),
      fillLightColor: lerpColor(from.fillLightColor, to.fillLightColor, easedProgress),
      hemisphereIntensity: lerp(from.hemisphereIntensity, to.hemisphereIntensity, easedProgress),
      hemisphereSkyColor: lerpColor(from.hemisphereSkyColor, to.hemisphereSkyColor, easedProgress),
      hemisphereGroundColor: lerpColor(
        from.hemisphereGroundColor,
        to.hemisphereGroundColor,
        easedProgress,
      ),
    }
  }, [currentWeather, previousWeather, transitionProgress, isTransitioning])

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={config.ambientIntensity} />

      {/* Main sun light */}
      <directionalLight
        position={[50, 80, 30]}
        intensity={config.sunIntensity}
        color={config.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[-30, 40, -20]}
        intensity={config.fillLightIntensity}
        color={config.fillLightColor}
      />

      {/* Hemisphere light for natural sky/ground lighting */}
      <hemisphereLight
        args={[config.hemisphereSkyColor, config.hemisphereGroundColor, config.hemisphereIntensity]}
      />

      {/* Front fill light to illuminate car face - scales with ambient */}
      <pointLight
        position={[0, 10, 30]}
        intensity={50 * config.ambientIntensity}
        distance={60}
        color='#ffffff'
      />
    </>
  )
}

export { lerpColor }
