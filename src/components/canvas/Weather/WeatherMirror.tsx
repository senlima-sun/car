import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSessionStore, isRunningSessionPhase } from '@/stores/useSessionStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { readStepBundle } from '@/wasm/stepBundleSnapshot'

const MIRROR_INTERVAL_S = 0.5

export default function WeatherMirror() {
  const phase = useSessionStore(s => s.phase)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!isRunningSessionPhase(phase)) return
    elapsedRef.current += delta
    if (elapsedRef.current < MIRROR_INTERVAL_S) return
    elapsedRef.current = 0

    const ambient = readStepBundle().ambient
    if (!ambient) return

    const env = useEnvironmentStore.getState()
    const celsius = ambient.temperature * 70 - 20
    if (Math.abs(env.temperature - celsius) > 0.1) {
      env.setTemperature(celsius)
    }
    if (Math.abs(env.humidity - ambient.humidity) > 0.005) {
      env.setHumidity(ambient.humidity)
    }
    if (Math.abs(env.rainIntensity - ambient.rain_intensity) > 0.005) {
      env.setRainIntensity(ambient.rain_intensity)
    }
  })

  return null
}
