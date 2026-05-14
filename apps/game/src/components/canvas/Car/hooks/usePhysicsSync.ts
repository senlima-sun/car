import { useEffect, useRef } from 'react'
import { useTireStore } from '../../../../stores/useTireStore'
import { useSurfaceStore, type SurfaceType } from '../../../../stores/useSurfaceStore'
import { useWindStore } from '../../../../stores/useWindStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import { usePhysics } from '../../../../wasm'
import { mapTireToWasm, mapSurfaceToWasm } from './wasmMappings'

export function usePhysicsSync() {
  const physics = usePhysics()

  const currentCompound = useTireStore(state => state.currentCompound)
  const lastCompoundRef = useRef<string>('')

  const currentSurface = useSurfaceStore(state => state.currentSurface)
  const lastSurfaceRef = useRef<SurfaceType>('grass')

  const windDirection = useWindStore(state => state.direction)
  const windSpeed = useWindStore(state => state.speed)
  const windEnabled = useWindStore(state => state.enabled)
  const lastWindRef = useRef({ direction: -999, speed: -1, enabled: !windEnabled })

  const envTemperature = useEnvironmentStore(state => state.temperature)
  const envHumidity = useEnvironmentStore(state => state.humidity)
  const envPrecipitationRate = useEnvironmentStore(state => state.precipitationRate)
  const envPressure = useEnvironmentStore(state => state.pressure)
  const envCloudCover = useEnvironmentStore(state => state.cloudCover)
  const lastEnvRef = useRef({
    temperature: -999,
    humidity: -1,
    precipitationRate: -1,
    pressure: -1,
    cloudCover: -1,
  })

  useEffect(() => {
    if (currentCompound !== lastCompoundRef.current) {
      physics.setTireCompound(mapTireToWasm(currentCompound))
      lastCompoundRef.current = currentCompound
    }
  }, [currentCompound, physics])

  useEffect(() => {
    if (currentSurface !== lastSurfaceRef.current) {
      physics.setSurface(mapSurfaceToWasm(currentSurface))
      lastSurfaceRef.current = currentSurface
    }
  }, [currentSurface, physics])

  useEffect(() => {
    if (
      windDirection !== lastWindRef.current.direction ||
      windSpeed !== lastWindRef.current.speed
    ) {
      physics.setWind(windDirection, windSpeed)
      lastWindRef.current.direction = windDirection
      lastWindRef.current.speed = windSpeed
    }
  }, [windDirection, windSpeed, physics])

  useEffect(() => {
    if (windEnabled !== lastWindRef.current.enabled) {
      physics.setWindEnabled(windEnabled)
      lastWindRef.current.enabled = windEnabled
    }
  }, [windEnabled, physics])

  useEffect(() => {
    const envChanged =
      envTemperature !== lastEnvRef.current.temperature ||
      envHumidity !== lastEnvRef.current.humidity ||
      envPrecipitationRate !== lastEnvRef.current.precipitationRate ||
      envPressure !== lastEnvRef.current.pressure ||
      envCloudCover !== lastEnvRef.current.cloudCover

    if (envChanged) {
      physics.setEnvironment(
        envTemperature,
        envHumidity,
        envPrecipitationRate,
        envPressure,
        envCloudCover,
      )
      lastEnvRef.current = {
        temperature: envTemperature,
        humidity: envHumidity,
        precipitationRate: envPrecipitationRate,
        pressure: envPressure,
        cloudCover: envCloudCover,
      }
    }
  }, [envTemperature, envHumidity, envPrecipitationRate, envPressure, envCloudCover, physics])

  return { physics, windEnabled }
}
