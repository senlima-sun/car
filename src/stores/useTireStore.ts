import { create } from 'zustand'
import {
  TireCompound,
  TireModifiers,
  TIRE_CONFIG,
  DEFAULT_TIRE,
  getWearGripMultiplier,
} from '../constants/tires'
import { WeatherCondition } from '../constants/weather'

interface TireState {
  // Current tire compound
  currentCompound: TireCompound

  // Tire wear percentage (0-100, where 100 = fully worn)
  wear: number

  // Computed effective grip based on compound, weather, and wear
  effectiveGripMultiplier: number

  // Current weather for grip calculations
  currentWeather: WeatherCondition

  // Actions
  setTireCompound: (compound: TireCompound) => void
  updateWear: (delta: number, speedMs: number, isDrifting: boolean) => void
  resetWear: () => void
  updateWeather: (weather: WeatherCondition) => void

  // Computed getters
  getTireConfig: () => TireModifiers
  calculateEffectiveGrip: () => number
}

export const useTireStore = create<TireState>((set, get) => ({
  currentCompound: DEFAULT_TIRE,
  wear: 0,
  effectiveGripMultiplier: 1.0,
  currentWeather: 'dry',

  setTireCompound: compound => {
    set({ currentCompound: compound })
    // Recalculate grip after compound change
    const newGrip = get().calculateEffectiveGrip()
    set({ effectiveGripMultiplier: newGrip })
  },

  updateWear: (delta, speedMs, isDrifting) => {
    const state = get()
    const config = TIRE_CONFIG[state.currentCompound]

    // Base wear rate from tire config
    let wearRate = config.degradationRate

    // Speed factor - faster = more wear (normalized to ~30 m/s = 100 km/h)
    const speedFactor = Math.max(0.2, speedMs / 30)
    wearRate *= speedFactor

    // Drifting increases wear by 3x
    if (isDrifting) {
      wearRate *= 3
    }

    // Wrong weather increases wear
    if (!config.optimalWeather.includes(state.currentWeather)) {
      wearRate *= 1.5
    }

    // Apply wear (convert rate to percentage)
    const newWear = Math.min(100, state.wear + wearRate * delta * 100)

    // Recalculate effective grip
    const newGrip = get().calculateEffectiveGrip()

    set({ wear: newWear, effectiveGripMultiplier: newGrip })
  },

  resetWear: () => {
    set({ wear: 0 })
    // Recalculate grip after reset
    const newGrip = get().calculateEffectiveGrip()
    set({ effectiveGripMultiplier: newGrip })
  },

  updateWeather: weather => {
    set({ currentWeather: weather })
    // Recalculate grip when weather changes
    const newGrip = get().calculateEffectiveGrip()
    set({ effectiveGripMultiplier: newGrip })
  },

  getTireConfig: () => {
    const state = get()
    return TIRE_CONFIG[state.currentCompound]
  },

  calculateEffectiveGrip: () => {
    const state = get()
    const config = TIRE_CONFIG[state.currentCompound]

    // Start with base grip multiplier from tire compound
    let grip = config.gripMultiplier

    // Apply weather compatibility
    const isOptimalWeather = config.optimalWeather.includes(state.currentWeather)
    if (!isOptimalWeather) {
      // Apply wrong weather penalty
      grip *= config.wrongWeatherPenalty
    }

    // Apply wear degradation
    grip *= getWearGripMultiplier(state.wear)

    return grip
  },
}))
