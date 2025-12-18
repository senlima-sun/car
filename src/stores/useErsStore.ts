import { create } from 'zustand'
import type { ErsMode, ErsState } from '../wasm/PhysicsBridge'

interface ErsStoreState {
  batteryCharge: number // 0-100
  mode: ErsMode
  powerFlow: number // kW (positive=deploy, negative=harvest)
  isDeploying: boolean
  isHarvesting: boolean

  // Actions
  setMode: (mode: ErsMode) => void
  cycleMode: () => void
  syncFromPhysics: (state: ErsState) => void
}

const MODE_CYCLE: ErsMode[] = ['Balanced', 'Attack', 'Harvest']

export const useErsStore = create<ErsStoreState>((set, get) => ({
  batteryCharge: 100,
  mode: 'Balanced',
  powerFlow: 0,
  isDeploying: false,
  isHarvesting: false,

  setMode: (mode: ErsMode) => {
    set({ mode })
  },

  cycleMode: () => {
    const currentMode = get().mode
    const currentIndex = MODE_CYCLE.indexOf(currentMode)
    const nextIndex = (currentIndex + 1) % MODE_CYCLE.length
    const nextMode = MODE_CYCLE[nextIndex]
    set({ mode: nextMode })
  },

  syncFromPhysics: (state: ErsState) => {
    set({
      batteryCharge: state.battery_charge * 100, // Convert 0-1 to 0-100
      mode: state.mode,
      powerFlow: state.power_flow,
      isDeploying: state.is_deploying,
      isHarvesting: state.is_harvesting,
    })
  },
}))
