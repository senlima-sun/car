/**
 * React context provider for WASM physics engine
 */

import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react'
import { getLogger } from '../debug/ActionLogger'
import { IS_DEV } from '../utils/isDev'
import {
  initPhysicsEngine,
  stepPhysics,
  stepAndSync,
  getWeatherModifiers,
  getAmbientConditions,
  // Weather API
  setCustomWeather,
  getRainIntensity,
  // Environment API
  setEnvironment,
  getAirDensity,
  getSurfaceFrictionBreakdown,
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
  resetTireBlowout,
  getEffectiveGrip,
  getBoostPressureBar,
  getFuelMassKg,
  getFuelFlowFactor,
  setFuelMassKg,
  getFuelMixMode,
  setFuelMixMode,
  getDiffPreloadNm,
  setDiffPreloadNm,
  getDiffPowerRampDeg,
  setDiffPowerRampDeg,
  getDiffCoastRampDeg,
  setDiffCoastRampDeg,
  setOnCurb,
  isOnCurb,
  setSurface,
  getSurface,
  isOnRoad,
  isOffTrack,
  getSurfaceModifiers,
  getTrackCellCount,
  updateCarDriving,
  // Road temperature API
  setRoadCell,
  setRoadRegion,
  // Water depth
  getWaterDepth,
  getActiveSurfaceCells,
  // Rubber deposit / tire marks API
  updateRubberDeposits,
  getTrackWetness,
  getRubberDepositMultiplier,
  updateRubberFrame,
  // ERS API
  setErsMode,
  getErsMode,
  getErsBatteryCharge,
  setErsBatteryCharge,
  setErsOvertakeAvailable,
  getErsState,
  // Semi-Auto ERS API
  setErsSemiAutoPreset,
  getErsSemiAutoPreset,
  getErsSemiAutoConfig,
  setErsLapMode,
  setErsExpertMode,
  activateErsOvertake,
  deactivateErsOvertake,
  isErsOvertakeOverride,
  // Active Aero API
  setAeroMode,
  getAeroMode,
  getActiveAeroState,
  toggleAeroAuto,
  setDrsZone,
  disableDrsOnBrake,
  resetErsLap,
  // Brake System API
  setBrakeBias,
  getBrakeBias,
  increaseBrakeBias,
  decreaseBrakeBias,
  setEngineBrakingLevel,
  getEngineBrakingLevel,
  cycleEngineBrakingLevel,
  getBrakeState,
  // Terrain API
  initTerrain,
  setTerrainCell,
  setTerrainRegion,
  setTerrainHeight,
  queryTerrain,
  isTerrainInitialized,
  loadTerrainHeightmap,
  clearTerrain,
  CarInput,
  CarPhysicsOutput,
  WeatherModifiers,
  AmbientConditions,
  SurfaceModifiers,
  PerWheelWear,
  StepAndSyncOutput,
  RubberFrameResult,
  TerrainQueryResult,
  TerrainMaterialProperties,
  TerrainMaterial,
  PerWheelTerrain,
  BottomingOutState,
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
  PerWheelWear,
  StepAndSyncOutput,
  RubberFrameResult,
  TerrainQueryResult,
  TerrainMaterialProperties,
  TerrainMaterial,
  PerWheelTerrain,
  BottomingOutState,
}
export { TireCompound, SurfaceType }

interface PhysicsContextValue {
  initialized: boolean
  stepPhysics: typeof stepPhysics
  stepAndSync: typeof stepAndSync
  getWeatherModifiers: typeof getWeatherModifiers
  getAmbientConditions: typeof getAmbientConditions
  // Weather API
  setCustomWeather: typeof setCustomWeather
  getRainIntensity: typeof getRainIntensity
  // Environment API
  setEnvironment: typeof setEnvironment
  getAirDensity: typeof getAirDensity
  getSurfaceFrictionBreakdown: typeof getSurfaceFrictionBreakdown
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
  resetTireBlowout: typeof resetTireBlowout
  getEffectiveGrip: typeof getEffectiveGrip
  getBoostPressureBar: typeof getBoostPressureBar
  getFuelMassKg: typeof getFuelMassKg
  getFuelFlowFactor: typeof getFuelFlowFactor
  setFuelMassKg: typeof setFuelMassKg
  getFuelMixMode: typeof getFuelMixMode
  setFuelMixMode: typeof setFuelMixMode
  getDiffPreloadNm: typeof getDiffPreloadNm
  setDiffPreloadNm: typeof setDiffPreloadNm
  getDiffPowerRampDeg: typeof getDiffPowerRampDeg
  setDiffPowerRampDeg: typeof setDiffPowerRampDeg
  getDiffCoastRampDeg: typeof getDiffCoastRampDeg
  setDiffCoastRampDeg: typeof setDiffCoastRampDeg
  setOnCurb: typeof setOnCurb
  isOnCurb: typeof isOnCurb
  setSurface: typeof setSurface
  getSurface: typeof getSurface
  isOnRoad: typeof isOnRoad
  isOffTrack: typeof isOffTrack
  getSurfaceModifiers: typeof getSurfaceModifiers
  getTrackCellCount: typeof getTrackCellCount
  updateCarDriving: typeof updateCarDriving
  // Road temperature API
  setRoadCell: typeof setRoadCell
  setRoadRegion: typeof setRoadRegion
  // Water depth
  getWaterDepth: typeof getWaterDepth
  getActiveSurfaceCells: typeof getActiveSurfaceCells
  // Rubber deposit / tire marks API
  updateRubberDeposits: typeof updateRubberDeposits
  getTrackWetness: typeof getTrackWetness
  getRubberDepositMultiplier: typeof getRubberDepositMultiplier
  updateRubberFrame: typeof updateRubberFrame
  // ERS API
  setErsMode: typeof setErsMode
  getErsMode: typeof getErsMode
  getErsBatteryCharge: typeof getErsBatteryCharge
  setErsBatteryCharge: typeof setErsBatteryCharge
  setErsOvertakeAvailable: typeof setErsOvertakeAvailable
  getErsState: typeof getErsState
  // Semi-Auto ERS API
  setErsSemiAutoPreset: typeof setErsSemiAutoPreset
  getErsSemiAutoPreset: typeof getErsSemiAutoPreset
  getErsSemiAutoConfig: typeof getErsSemiAutoConfig
  setErsLapMode: typeof setErsLapMode
  setErsExpertMode: typeof setErsExpertMode
  activateErsOvertake: typeof activateErsOvertake
  deactivateErsOvertake: typeof deactivateErsOvertake
  isErsOvertakeOverride: typeof isErsOvertakeOverride
  // Active Aero API
  setAeroMode: typeof setAeroMode
  getAeroMode: typeof getAeroMode
  getActiveAeroState: typeof getActiveAeroState
  toggleAeroAuto: typeof toggleAeroAuto
  setDrsZone: typeof setDrsZone
  disableDrsOnBrake: typeof disableDrsOnBrake
  resetErsLap: typeof resetErsLap
  // Brake System API
  setBrakeBias: typeof setBrakeBias
  getBrakeBias: typeof getBrakeBias
  increaseBrakeBias: typeof increaseBrakeBias
  decreaseBrakeBias: typeof decreaseBrakeBias
  setEngineBrakingLevel: typeof setEngineBrakingLevel
  getEngineBrakingLevel: typeof getEngineBrakingLevel
  cycleEngineBrakingLevel: typeof cycleEngineBrakingLevel
  getBrakeState: typeof getBrakeState
  // Terrain API
  initTerrain: typeof initTerrain
  setTerrainCell: typeof setTerrainCell
  setTerrainRegion: typeof setTerrainRegion
  setTerrainHeight: typeof setTerrainHeight
  queryTerrain: typeof queryTerrain
  isTerrainInitialized: typeof isTerrainInitialized
  loadTerrainHeightmap: typeof loadTerrainHeightmap
  clearTerrain: typeof clearTerrain
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
          if (IS_DEV) {
            getLogger().log('system', 'system.wasm.ready', 'PhysicsProvider', {
              timestamp: Date.now(),
            })
          }
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

  const value: PhysicsContextValue = useMemo(
    () => ({
      initialized,
      stepPhysics,
      stepAndSync,
      getWeatherModifiers,
      getAmbientConditions,
      setCustomWeather,
      getRainIntensity,
      setEnvironment,
      getAirDensity,
      getSurfaceFrictionBreakdown,
      setWind,
      setWindEnabled,
      isWindEnabled,
      getWindState,
      getWindModifiers,
      setTireCompound,
      getTireCompound,
      getTireWear,
      getTireWearPerWheel,
      resetTireWear,
      resetTireBlowout,
      getEffectiveGrip,
      getBoostPressureBar,
      getFuelMassKg,
      getFuelFlowFactor,
      setFuelMassKg,
      getFuelMixMode,
      setFuelMixMode,
      getDiffPreloadNm,
      setDiffPreloadNm,
      getDiffPowerRampDeg,
      setDiffPowerRampDeg,
      getDiffCoastRampDeg,
      setDiffCoastRampDeg,
      setOnCurb,
      isOnCurb,
      setSurface,
      getSurface,
      isOnRoad,
      isOffTrack,
      getSurfaceModifiers,
      getTrackCellCount,
      updateCarDriving,
      setRoadCell,
      setRoadRegion,
      getWaterDepth,
      getActiveSurfaceCells,
      updateRubberDeposits,
      getTrackWetness,
      getRubberDepositMultiplier,
      updateRubberFrame,
      setErsMode,
      getErsMode,
      getErsBatteryCharge,
      setErsBatteryCharge,
      setErsOvertakeAvailable,
      getErsState,
      setErsSemiAutoPreset,
      getErsSemiAutoPreset,
      getErsSemiAutoConfig,
      setErsLapMode,
      setErsExpertMode,
      activateErsOvertake,
      deactivateErsOvertake,
      isErsOvertakeOverride,
      setAeroMode,
      getAeroMode,
      getActiveAeroState,
      toggleAeroAuto,
      setDrsZone,
      disableDrsOnBrake,
      resetErsLap,
      setBrakeBias,
      getBrakeBias,
      increaseBrakeBias,
      decreaseBrakeBias,
      setEngineBrakingLevel,
      getEngineBrakingLevel,
      cycleEngineBrakingLevel,
      getBrakeState,
      initTerrain,
      setTerrainCell,
      setTerrainRegion,
      setTerrainHeight,
      queryTerrain,
      isTerrainInitialized,
      loadTerrainHeightmap,
      clearTerrain,
    }),
    [initialized],
  )

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
