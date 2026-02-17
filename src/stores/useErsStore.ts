import { create } from 'zustand'
import type {
  ErsMode,
  ErsState,
  HarvestSource,
  SemiAutoPreset,
  SemiAutoState,
} from '../wasm/PhysicsBridge'

// Semi-Auto configuration for UI
export interface SemiAutoConfig {
  targetMin: number // 0-100
  targetMax: number // 0-100
  preset: SemiAutoPreset
  lapMode: boolean
  expertMode: boolean
}

// Preset configurations
const PRESET_CONFIGS: Record<SemiAutoPreset, { min: number; max: number }> = {
  Aggressive: { min: 25, max: 50 },
  Balanced: { min: 40, max: 70 },
  Conservative: { min: 60, max: 85 },
}

interface ErsStoreState {
  batteryCharge: number // 0-100
  mode: ErsMode
  powerFlow: number // kW (positive=deploy, negative=harvest)
  isDeploying: boolean
  isHarvesting: boolean
  // 2026 ERS fields
  superClipActive: boolean
  harvestSource: HarvestSource
  overtakeAvailable: boolean

  // Semi-Auto state
  semiAuto: SemiAutoState
  semiAutoConfig: SemiAutoConfig
  coastIndicatorVisible: boolean

  // Actions
  setMode: (mode: ErsMode) => void
  cycleMode: () => void
  activateOvertake: () => void
  syncFromPhysics: (state: ErsState) => void

  // Semi-Auto actions
  setSemiAutoPreset: (preset: SemiAutoPreset) => void
  cycleSemiAutoPreset: () => void
  setLapMode: (enabled: boolean) => void
  setExpertMode: (enabled: boolean) => void
  toggleCoastIndicator: () => void
}

// SemiAuto is now the default-only mode (no cycling needed)

// Preset cycle order
const PRESET_CYCLE: SemiAutoPreset[] = ['Balanced', 'Aggressive', 'Conservative']

export const useErsStore = create<ErsStoreState>((set, get) => ({
  batteryCharge: 100,
  mode: 'SemiAuto',
  powerFlow: 0,
  isDeploying: false,
  isHarvesting: false,
  superClipActive: false,
  harvestSource: 'None',
  overtakeAvailable: false,

  // Semi-Auto state
  semiAuto: {
    coast_recommended: false,
    coast_benefit: 0,
    deploy_efficiency: 1,
    is_critical: false,
    effective_deploy_mult: 0.35,
    effective_harvest_mult: 0.9,
  },
  semiAutoConfig: {
    targetMin: 40,
    targetMax: 70,
    preset: 'Balanced',
    lapMode: false,
    expertMode: false,
  },
  coastIndicatorVisible: true,

  setMode: (mode: ErsMode) => {
    set({ mode })
  },

  cycleMode: () => {
    // SemiAuto is the only mode - cycle presets instead
    get().cycleSemiAutoPreset()
  },

  activateOvertake: () => {
    const { overtakeAvailable } = get()
    if (overtakeAvailable) {
      set({ mode: 'Overtake' })
    }
  },

  syncFromPhysics: (state: ErsState) => {
    set({
      batteryCharge: state.battery_charge * 100, // Convert 0-1 to 0-100
      mode: state.mode,
      powerFlow: state.power_flow,
      isDeploying: state.is_deploying,
      isHarvesting: state.is_harvesting,
      superClipActive: state.super_clip_active,
      harvestSource: state.harvest_source,
      overtakeAvailable: state.overtake_available,
      // Sync Semi-Auto state
      semiAuto: state.semi_auto ?? get().semiAuto,
    })
  },

  // Semi-Auto actions
  setSemiAutoPreset: (preset: SemiAutoPreset) => {
    const config = PRESET_CONFIGS[preset]
    set(state => ({
      semiAutoConfig: {
        ...state.semiAutoConfig,
        preset,
        targetMin: config.min,
        targetMax: config.max,
      },
    }))
  },

  cycleSemiAutoPreset: () => {
    const currentPreset = get().semiAutoConfig.preset
    const currentIndex = PRESET_CYCLE.indexOf(currentPreset)
    const nextIndex = (currentIndex + 1) % PRESET_CYCLE.length
    const nextPreset = PRESET_CYCLE[nextIndex]
    get().setSemiAutoPreset(nextPreset)
  },

  setLapMode: (enabled: boolean) => {
    set(state => ({
      semiAutoConfig: { ...state.semiAutoConfig, lapMode: enabled },
    }))
  },

  setExpertMode: (enabled: boolean) => {
    set(state => ({
      semiAutoConfig: { ...state.semiAutoConfig, expertMode: enabled },
    }))
  },

  toggleCoastIndicator: () => {
    set(state => ({ coastIndicatorVisible: !state.coastIndicatorVisible }))
  },
}))
