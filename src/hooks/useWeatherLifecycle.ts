import { useEffect, useRef } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { readStepBundle } from '@/wasm/stepBundleSnapshot'
import type { SessionWeatherPreset } from '@/types/session'

interface WeatherPresetValues {
  temperature: number
  humidity: number
  precipitationRate: number
  cloudCover: number
}

function resolvePreset(preset: SessionWeatherPreset): WeatherPresetValues | null {
  switch (preset) {
    case 'dry':
      return { temperature: 26, humidity: 0.3, precipitationRate: 0, cloudCover: 0.15 }
    case 'wet':
      return { temperature: 14, humidity: 0.92, precipitationRate: 18, cloudCover: 0.85 }
    case 'random': {
      const wet = Math.random() < 0.3
      if (wet) {
        return {
          temperature: 8 + Math.random() * 14,
          humidity: 0.7 + Math.random() * 0.25,
          precipitationRate: 6 + Math.random() * 30,
          cloudCover: 0.6 + Math.random() * 0.4,
        }
      }
      return {
        temperature: 14 + Math.random() * 22,
        humidity: 0.2 + Math.random() * 0.4,
        precipitationRate: 0,
        cloudCover: Math.random() * 0.5,
      }
    }
    case 'current':
    default:
      return null
  }
}

const MIRROR_INTERVAL_MS = 500

/**
 * Wires the weather preset at session start and mirrors the WASM
 * engine's ambient conditions back into useEnvironmentStore at 2 Hz
 * while the session is running, so HUD widgets and sky/particle
 * effects reflect the evolving model instead of a frozen snapshot.
 */
export function useWeatherLifecycle(): void {
  const phase = useSessionStore(s => s.phase)
  const weatherPreset = useSessionStore(s => s.config?.weatherPreset)
  const prevPhaseRef = useRef(phase)

  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase

    const enteringRun =
      (prev === 'setup' || prev === 'countdown' || prev === 'idle') &&
      (phase === 'countdown' || phase === 'running')

    if (!enteringRun || !weatherPreset) return

    const values = resolvePreset(weatherPreset)
    if (!values) return

    const env = useEnvironmentStore.getState()
    env.setTemperature(values.temperature)
    env.setHumidity(values.humidity)
    env.setPrecipitationRate(values.precipitationRate)
    env.setCloudCover(values.cloudCover)
  }, [phase, weatherPreset])

  useEffect(() => {
    if (phase !== 'running') return

    const id = window.setInterval(() => {
      const snap = readStepBundle()
      const ambient = snap.ambient
      if (!ambient) return
      const celsius = ambient.temperature * 70 - 20
      const env = useEnvironmentStore.getState()
      if (Math.abs(env.temperature - celsius) > 0.1) {
        env.setTemperature(celsius)
      }
      if (Math.abs(env.humidity - ambient.humidity) > 0.005) {
        env.setHumidity(ambient.humidity)
      }
      if (Math.abs(env.rainIntensity - ambient.rain_intensity) > 0.005) {
        env.setRainIntensity(ambient.rain_intensity)
      }
    }, MIRROR_INTERVAL_MS)

    return () => window.clearInterval(id)
  }, [phase])
}
