/**
 * React context provider for WASM physics engine
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  initPhysicsEngine,
  stepPhysics,
  getWeatherModifiers,
  getAmbientConditions,
  // Weather API
  setCustomWeather,
  getRainIntensity,
  // Wind API
  setWind,
  setWindEnabled,
  isWindEnabled,
  getWindState,
  getWindModifiers,
  // Tire API
  setTireCompound,
  getTireCompound,
  getTireWear,
  getTireWearPerWheel,
  resetTireWear,
  getEffectiveGrip,
  setOnCurb,
  isOnCurb,
  setSurface,
  getSurface,
  isOnRoad,
  isOffTrack,
  getSurfaceModifiers,
  initTrackTemperature,
  getTrackTextureData,
  getTrackCellCount,
  updateCarDriving,
  // Road temperature API
  setRoadCell,
  setRoadRegion,
  // Rubber deposit / tire marks API
  updateRubberDeposits,
  getTrackWetness,
  getRubberDepositMultiplier,
  CarInput,
  CarPhysicsOutput,
  WeatherModifiers,
  AmbientConditions,
  SurfaceModifiers,
  TrackBounds,
  PerWheelWear,
  TireCompound,
  SurfaceType,
} from './PhysicsBridge'

// Re-export types
export type {
  CarInput,
  CarPhysicsOutput,
  WeatherModifiers,
  AmbientConditions,
  SurfaceModifiers,
  TrackBounds,
  PerWheelWear,
}
export { TireCompound, SurfaceType }

interface PhysicsContextValue {
  initialized: boolean
  stepPhysics: typeof stepPhysics
  getWeatherModifiers: typeof getWeatherModifiers
  getAmbientConditions: typeof getAmbientConditions
  // Weather API
  setCustomWeather: typeof setCustomWeather
  getRainIntensity: typeof getRainIntensity
  // Wind API
  setWind: typeof setWind
  setWindEnabled: typeof setWindEnabled
  isWindEnabled: typeof isWindEnabled
  getWindState: typeof getWindState
  getWindModifiers: typeof getWindModifiers
  // Tire API
  setTireCompound: typeof setTireCompound
  getTireCompound: typeof getTireCompound
  getTireWear: typeof getTireWear
  getTireWearPerWheel: typeof getTireWearPerWheel
  resetTireWear: typeof resetTireWear
  getEffectiveGrip: typeof getEffectiveGrip
  setOnCurb: typeof setOnCurb
  isOnCurb: typeof isOnCurb
  setSurface: typeof setSurface
  getSurface: typeof getSurface
  isOnRoad: typeof isOnRoad
  isOffTrack: typeof isOffTrack
  getSurfaceModifiers: typeof getSurfaceModifiers
  initTrackTemperature: typeof initTrackTemperature
  getTrackTextureData: typeof getTrackTextureData
  getTrackCellCount: typeof getTrackCellCount
  updateCarDriving: typeof updateCarDriving
  // Road temperature API
  setRoadCell: typeof setRoadCell
  setRoadRegion: typeof setRoadRegion
  // Rubber deposit / tire marks API
  updateRubberDeposits: typeof updateRubberDeposits
  getTrackWetness: typeof getTrackWetness
  getRubberDepositMultiplier: typeof getRubberDepositMultiplier
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
    getWeatherModifiers,
    getAmbientConditions,
    // Weather API
    setCustomWeather,
    getRainIntensity,
    // Wind API
    setWind,
    setWindEnabled,
    isWindEnabled,
    getWindState,
    getWindModifiers,
    // Tire API
    setTireCompound,
    getTireCompound,
    getTireWear,
    getTireWearPerWheel,
    resetTireWear,
    getEffectiveGrip,
    setOnCurb,
    isOnCurb,
    setSurface,
    getSurface,
    isOnRoad,
    isOffTrack,
    getSurfaceModifiers,
    initTrackTemperature,
    getTrackTextureData,
    getTrackCellCount,
    updateCarDriving,
    // Road temperature API
    setRoadCell,
    setRoadRegion,
    // Rubber deposit / tire marks API
    updateRubberDeposits,
    getTrackWetness,
    getRubberDepositMultiplier,
  }

  return <PhysicsContext.Provider value={value}>{children}</PhysicsContext.Provider>
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
