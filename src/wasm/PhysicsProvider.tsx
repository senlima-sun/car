/**
 * React context provider for WASM physics engine
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import {
  initPhysicsEngine,
  stepPhysics,
  setWeather,
  getWeather,
  getWeatherModifiers,
  setTireCompound,
  getTireCompound,
  getTireWear,
  resetTireWear,
  getEffectiveGrip,
  setOnCurb,
  isOnCurb,
  initTrackTemperature,
  getTrackTextureData,
  getTrackCellCount,
  CarInput,
  CarPhysicsOutput,
  WeatherModifiers,
  TrackBounds,
  WeatherCondition,
  TireCompound,
} from './PhysicsBridge'

// Re-export types
export type {
  CarInput,
  CarPhysicsOutput,
  WeatherModifiers,
  TrackBounds,
}
export { WeatherCondition, TireCompound }

interface PhysicsContextValue {
  initialized: boolean
  stepPhysics: typeof stepPhysics
  setWeather: typeof setWeather
  getWeather: typeof getWeather
  getWeatherModifiers: typeof getWeatherModifiers
  setTireCompound: typeof setTireCompound
  getTireCompound: typeof getTireCompound
  getTireWear: typeof getTireWear
  resetTireWear: typeof resetTireWear
  getEffectiveGrip: typeof getEffectiveGrip
  setOnCurb: typeof setOnCurb
  isOnCurb: typeof isOnCurb
  initTrackTemperature: typeof initTrackTemperature
  getTrackTextureData: typeof getTrackTextureData
  getTrackCellCount: typeof getTrackCellCount
}

const PhysicsContext = createContext<PhysicsContextValue | null>(null)

interface PhysicsProviderProps {
  children: ReactNode
  fallback?: ReactNode
}

export function PhysicsProvider({ children, fallback }: PhysicsProviderProps) {
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        await initPhysicsEngine()
        if (mounted) {
          setInitialized(true)
          console.log('[PhysicsProvider] WASM physics engine ready')
        }
      } catch (err) {
        if (mounted) {
          console.error('[PhysicsProvider] Failed to initialize:', err)
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  if (error) {
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        Failed to load physics engine: {error.message}
      </div>
    )
  }

  if (!initialized) {
    return fallback ? <>{fallback}</> : null
  }

  const value: PhysicsContextValue = {
    initialized,
    stepPhysics,
    setWeather,
    getWeather,
    getWeatherModifiers,
    setTireCompound,
    getTireCompound,
    getTireWear,
    resetTireWear,
    getEffectiveGrip,
    setOnCurb,
    isOnCurb,
    initTrackTemperature,
    getTrackTextureData,
    getTrackCellCount,
  }

  return (
    <PhysicsContext.Provider value={value}>
      {children}
    </PhysicsContext.Provider>
  )
}

export function usePhysics(): PhysicsContextValue {
  const context = useContext(PhysicsContext)
  if (!context) {
    throw new Error('usePhysics must be used within a PhysicsProvider')
  }
  return context
}

export function usePhysicsOptional(): PhysicsContextValue | null {
  return useContext(PhysicsContext)
}
