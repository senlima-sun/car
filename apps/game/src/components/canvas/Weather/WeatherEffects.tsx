import { useMemo } from 'react'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { ATMOSPHERE_CONFIG } from '../../../constants/weather'
import SurfaceEffects from './SurfaceEffects'
import { GPURain } from './particles/GPURain'
import { InstancedRainSplash } from './particles/InstancedRainSplash'
import { InstancedSnow } from './particles/InstancedSnow'
import { InstancedSnowSplash } from './particles/InstancedSnowSplash'
import { InstancedHeat } from './particles/InstancedHeat'

function DynamicFog() {
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const fogConfig = useMemo(() => {
    let baseConfig = ATMOSPHERE_CONFIG.dry
    if (temperature < 0) {
      baseConfig = ATMOSPHERE_CONFIG.cold
    } else if (temperature > 35) {
      baseConfig = ATMOSPHERE_CONFIG.hot
    }

    if (rainIntensity > 0.01) {
      const rainConfig = ATMOSPHERE_CONFIG.rain
      const t = rainIntensity
      return {
        color: rainConfig.fogColor,
        near: baseConfig.fogNear + (rainConfig.fogNear - baseConfig.fogNear) * t,
        far: baseConfig.fogFar + (rainConfig.fogFar - baseConfig.fogFar) * t,
      }
    }

    return { color: baseConfig.fogColor, near: baseConfig.fogNear, far: baseConfig.fogFar }
  }, [temperature, rainIntensity])

  return <fog attach='fog' args={[fogConfig.color, fogConfig.near, fogConfig.far]} />
}

export default function WeatherEffects() {
  const temperature = useEnvironmentStore(state => state.temperature)
  const rainIntensity = useEnvironmentStore(state => state.rainIntensity)

  const showRain = rainIntensity > 0.01
  const showSnow = temperature < 0 && !showRain
  const showHeat = temperature > 35 && !showRain

  return (
    <>
      <DynamicFog />

      {showRain && (
        <>
          <GPURain />
          <InstancedRainSplash />
        </>
      )}

      {showSnow && (
        <>
          <InstancedSnow />
          <InstancedSnowSplash />
        </>
      )}

      {showHeat && <InstancedHeat />}

      <SurfaceEffects />
    </>
  )
}

export { InstancedHeat as HeatEffect }
