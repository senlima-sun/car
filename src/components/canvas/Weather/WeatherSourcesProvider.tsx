import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useWeatherSourcesStore } from '@/stores/useWeatherSourcesStore'
import { usePhysicsOptional } from '@/wasm/PhysicsProvider'
import type { WeatherSource } from '@/wasm'

const SYNC_INTERVAL_S = 0.1

function shallowEqual(a: WeatherSource[], b: WeatherSource[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.x !== y.x ||
      x.z !== y.z ||
      x.radius !== y.radius ||
      x.intensity !== y.intensity ||
      x.vx !== y.vx ||
      x.vz !== y.vz
    ) {
      return false
    }
  }
  return true
}

export default function WeatherSourcesProvider() {
  const physics = usePhysicsOptional()
  const acc = useRef(0)
  const lastRef = useRef<WeatherSource[]>([])

  useFrame((_, delta) => {
    if (!physics) return
    acc.current += delta
    if (acc.current < SYNC_INTERVAL_S) return
    acc.current = 0

    const next = physics.getWeatherSources()
    if (!shallowEqual(next, lastRef.current)) {
      lastRef.current = next
      useWeatherSourcesStore.getState().setSources(next)
    }
  })

  return null
}
