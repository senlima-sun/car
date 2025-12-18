import { create } from 'zustand'
import type { ErsMode, ErsState, HarvestSource } from '../wasm/PhysicsBridge'

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

  // Actions
  setMode: (mode: ErsMode) => void
  cycleMode: () => void
  activateOvertake: () => void
  syncFromPhysics: (state: ErsState) => void
}

// Standard mode cycle (Overtake is manual activation only)
const MODE_CYCLE: ErsMode[] = ['Balanced', 'Attack', 'Harvest']

export const useErsStore = create<ErsStoreState>((set, get) => ({
  batteryCharge: 100,
  mode: 'Balanced',
  powerFlow: 0,
  isDeploying: false,
  isHarvesting: false,
  superClipActive: false,
  harvestSource: 'None',
  overtakeAvailable: false,

  setMode: (mode: ErsMode) => {
    set({ mode })
  },

  cycleMode: () => {
    const currentMode = get().mode
    // If in Overtake, cycle back to Balanced
    if (currentMode === 'Overtake') {
      set({ mode: 'Balanced' })
      return
    }
    const currentIndex = MODE_CYCLE.indexOf(currentMode)
    const nextIndex = (currentIndex + 1) % MODE_CYCLE.length
    const nextMode = MODE_CYCLE[nextIndex]
    set({ mode: nextMode })
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
    })
  },
}))
