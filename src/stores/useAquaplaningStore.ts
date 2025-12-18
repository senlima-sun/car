import { create } from 'zustand'

// Aquaplaning state tracking for WASM physics integration
// Physics calculations are handled by the Rust/WASM engine

interface AquaplaningState {
  // Whether the car is currently aquaplaning
  isAquaplaning: boolean

  // Intensity of aquaplaning (0.0-1.0)
  intensity: number

  // Which wheels are affected [FL, FR, RL, RR]
  affectedWheels: [boolean, boolean, boolean, boolean]

  // Tire thermal shock state
  isThermalShock: boolean
  thermalShockPenalty: number
  thermalShockRecoveryTime: number

  // Actions
  setAquaplaning: (
    isAquaplaning: boolean,
    intensity: number,
    affectedWheels: [boolean, boolean, boolean, boolean],
  ) => void
  setThermalShock: (isShocked: boolean, penalty: number, recoveryTime: number) => void
  reset: () => void
}

export const useAquaplaningStore = create<AquaplaningState>(set => ({
  isAquaplaning: false,
  intensity: 0,
  affectedWheels: [false, false, false, false],

  isThermalShock: false,
  thermalShockPenalty: 0,
  thermalShockRecoveryTime: 0,

  setAquaplaning: (isAquaplaning, intensity, affectedWheels) => {
    set({
      isAquaplaning,
      intensity,
      affectedWheels,
    })
  },

  setThermalShock: (isShocked, penalty, recoveryTime) => {
    set({
      isThermalShock: isShocked,
      thermalShockPenalty: penalty,
      thermalShockRecoveryTime: recoveryTime,
    })
  },

  reset: () => {
    set({
      isAquaplaning: false,
      intensity: 0,
      affectedWheels: [false, false, false, false],
      isThermalShock: false,
      thermalShockPenalty: 0,
      thermalShockRecoveryTime: 0,
    })
  },
}))
