import { useMemo } from 'react'
import { Cloud } from '@react-three/drei'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import { ATMOSPHERE_CONFIG } from '../../../constants/weather'
import { lerp } from './DynamicSky'

// Base cloud positions - 12 positions for maximum weather coverage
const CLOUD_POSITIONS: [number, number, number][] = [
  [-40, 60, -100],
  [60, 70, -150],
  [-80, 55, -80],
  [100, 65, -120],
  [0, 80, -200],
  [-120, 75, -180],
  [80, 50, 100],
  [-60, 65, 150],
  [40, 72, -130],
  [-100, 58, 80],
  [90, 68, 0],
  [-50, 75, -50],
]

// Cloud speeds for variation
const CLOUD_SPEEDS = [0.2, 0.1, 0.15, 0.25, 0.1, 0.2, 0.15, 0.2, 0.18, 0.12, 0.22, 0.14]

export default function DynamicClouds() {
  const currentWeather = useWeatherStore(s => s.currentWeather)
  const previousWeather = useWeatherStore(s => s.previousWeather)
  const transitionProgress = useWeatherStore(s => s.transitionProgress)
  const isTransitioning = useWeatherStore(s => s.isTransitioning)

  const config = useMemo(() => {
    if (!isTransitioning) {
      const atm = ATMOSPHERE_CONFIG[currentWeather]
      return {
        cloudOpacity: atm.cloudOpacity,
        cloudCount: atm.cloudCount,
        cloudColor: atm.cloudColor,
      }
    }

    const from = ATMOSPHERE_CONFIG[previousWeather]
    const to = ATMOSPHERE_CONFIG[currentWeather]
    // Smoothstep easing
    const easedProgress = transitionProgress * transitionProgress * (3 - 2 * transitionProgress)

    return {
      cloudOpacity: lerp(from.cloudOpacity, to.cloudOpacity, easedProgress),
      cloudCount: Math.round(lerp(from.cloudCount, to.cloudCount, easedProgress)),
      cloudColor: to.cloudColor, // Jump to target color
    }
  }, [currentWeather, previousWeather, transitionProgress, isTransitioning])

  return (
    <>
      {CLOUD_POSITIONS.slice(0, config.cloudCount).map((pos, i) => (
        <Cloud
          key={i}
          position={pos}
          speed={CLOUD_SPEEDS[i]}
          opacity={config.cloudOpacity}
          color={config.cloudColor}
        />
      ))}
    </>
  )
}
