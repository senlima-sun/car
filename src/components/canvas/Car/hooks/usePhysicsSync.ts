import { useEffect, useRef } from 'react'
import { useTireStore } from '../../../../stores/useTireStore'
import { useSurfaceStore, type SurfaceType } from '../../../../stores/useSurfaceStore'
import { useWindStore } from '../../../../stores/useWindStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import { usePhysics } from '../../../../wasm'
import { mapTireToWasm, mapSurfaceToWasm } from './wasmMappings'

/**
 * Hook to synchronize JS stores with WASM physics engine
 * Handles tire compound, surface, wind, and environment settings
 */
export function usePhysicsSync() {
  const physics = usePhysics()

  // Tire system
  const currentCompound = useTireStore(state => state.currentCompound)
  const lastCompoundRef = useRef<string>('')

  // Surface system
  const currentSurface = useSurfaceStore(state => state.currentSurface)
  const lastSurfaceRef = useRef<SurfaceType>('grass')

  // Wind system
  const windDirection = useWindStore(state => state.direction)
  const windSpeed = useWindStore(state => state.speed)
  const windEnabled = useWindStore(state => state.enabled)
  const lastWindRef = useRef({ direction: -999, speed: -1, enabled: !windEnabled })

  // Environment system (dynamic weather)
  const envTemperature = useEnvironmentStore(state => state.temperature)
  const envRainIntensity = useEnvironmentStore(state => state.rainIntensity)
  const lastEnvRef = useRef({ temperature: -999, rainIntensity: -1 })

  // Sync tire compound with WASM engine
  useEffect(() => {
    if (currentCompound !== lastCompoundRef.current) {
      physics.setTireCompound(mapTireToWasm(currentCompound))
      lastCompoundRef.current = currentCompound
    }
  }, [currentCompound, physics])

  // Sync surface type with WASM engine
  useEffect(() => {
    if (currentSurface !== lastSurfaceRef.current) {
      physics.setSurface(mapSurfaceToWasm(currentSurface))
      lastSurfaceRef.current = currentSurface
    }
  }, [currentSurface, physics])

  // Sync wind direction/speed with WASM engine
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

  // Sync wind enabled state with WASM engine
  useEffect(() => {
    if (windEnabled !== lastWindRef.current.enabled) {
      physics.setWindEnabled(windEnabled)
      lastWindRef.current.enabled = windEnabled
    }
  }, [windEnabled, physics])

  // Sync environment settings with WASM engine (custom weather mode)
  useEffect(() => {
    if (
      envTemperature !== lastEnvRef.current.temperature ||
      envRainIntensity !== lastEnvRef.current.rainIntensity
    ) {
      // Calculate humidity based on rain intensity (more rain = more humidity)
      const humidity = 0.3 + envRainIntensity * 0.6 // 30% to 90%
      physics.setCustomWeather(envTemperature, humidity, envRainIntensity)
      lastEnvRef.current.temperature = envTemperature
      lastEnvRef.current.rainIntensity = envRainIntensity
    }
  }, [envTemperature, envRainIntensity, physics])

  return { physics, windEnabled }
}
