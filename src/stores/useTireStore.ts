import { create } from 'zustand'
import {
  TireCompound,
  TireModifiers,
  TIRE_CONFIG,
  DEFAULT_TIRE,
  getWearGripMultiplier,
} from '../constants/tires'
import { WeatherCondition } from '../constants/weather'

// Per-wheel wear data (0-100 percentage)
export interface PerWheelWear {
  frontLeft: number
  frontRight: number
  rearLeft: number
  rearRight: number
}

interface TireState {
  // Current tire compound
  currentCompound: TireCompound

  // Per-wheel tire wear (0-100, where 100 = fully worn)
  perWheelWear: PerWheelWear

  // Average wear across all wheels
  averageWear: number

  // Computed effective grip based on compound, weather, and wear
  effectiveGripMultiplier: number

  // Current weather for grip calculations
  currentWeather: WeatherCondition

  // Actions
  setTireCompound: (compound: TireCompound) => void
  syncFromWasm: (wear: PerWheelWear) => void
  resetWear: () => void
  updateWeather: (weather: WeatherCondition) => void

  // Computed getters
  getTireConfig: () => TireModifiers
  calculateEffectiveGrip: () => number
  getWorstWheel: () => { position: string; wear: number }
}

const initialPerWheelWear: PerWheelWear = {
  frontLeft: 0,
  frontRight: 0,
  rearLeft: 0,
  rearRight: 0,
}

export const useTireStore = create<TireState>((set, get) => ({
  currentCompound: DEFAULT_TIRE,
  perWheelWear: { ...initialPerWheelWear },
  averageWear: 0,
  effectiveGripMultiplier: 1.0,
  currentWeather: 'dry',

  setTireCompound: compound => {
    set({
      currentCompound: compound,
      perWheelWear: { ...initialPerWheelWear },
      averageWear: 0,
    })
    // Recalculate grip after compound change
    const newGrip = get().calculateEffectiveGrip()
    set({ effectiveGripMultiplier: newGrip })
  },

  // Sync tire wear from WASM engine (called every frame)
  syncFromWasm: wear => {
    const avgWear =
      (wear.frontLeft + wear.frontRight + wear.rearLeft + wear.rearRight) / 4

    set({
      perWheelWear: wear,
      averageWear: avgWear,
    })

    // Recalculate effective grip
    const newGrip = get().calculateEffectiveGrip()
    set({ effectiveGripMultiplier: newGrip })
  },

  resetWear: () => {
    set({
      perWheelWear: { ...initialPerWheelWear },
      averageWear: 0,
    })
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

    // Apply wear degradation using average wear
    grip *= getWearGripMultiplier(state.averageWear)

    return grip
  },

  getWorstWheel: () => {
    const { perWheelWear } = get()
    const wheels = [
      { position: 'FL', wear: perWheelWear.frontLeft },
      { position: 'FR', wear: perWheelWear.frontRight },
      { position: 'RL', wear: perWheelWear.rearLeft },
      { position: 'RR', wear: perWheelWear.rearRight },
    ]
    return wheels.reduce((max, w) => (w.wear > max.wear ? w : max), wheels[0])
  },
}))
