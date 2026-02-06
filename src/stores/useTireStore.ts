import { create } from 'zustand'
import type { TireCompound, TireDisplayConfig } from '../constants/tires'
import { TIRE_CONFIG, DEFAULT_TIRE } from '../constants/tires'
import { setTireWear as setTireWearWasm } from '../wasm/PhysicsBridge'
import type { GripBreakdown, TireMaterialOutput } from '../wasm/PhysicsBridge'

export interface PerWheelWear {
  frontLeft: number
  frontRight: number
  rearLeft: number
  rearRight: number
}

interface TireState {
  currentCompound: TireCompound
  perWheelWear: PerWheelWear
  averageWear: number
  effectiveGripMultiplier: number
  gripBreakdown: GripBreakdown | null
  tireMaterial: TireMaterialOutput | null
  debugMode: boolean

  setTireCompound: (compound: TireCompound) => void
  syncFromWasm: (wear: PerWheelWear, effectiveGrip: number) => void
  syncGripBreakdown: (breakdown: GripBreakdown) => void
  syncTireMaterial: (material: TireMaterialOutput) => void
  resetWear: () => void
  setWearDebug: (wearPercentage: number) => void
  disableDebugMode: () => void
  getTireConfig: () => TireDisplayConfig
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
  gripBreakdown: null,
  tireMaterial: null,
  debugMode: false,

  setTireCompound: compound => {
    set({
      currentCompound: compound,
      perWheelWear: { ...initialPerWheelWear },
      averageWear: 0,
    })
  },

  syncFromWasm: (wear, effectiveGrip) => {
    if (get().debugMode) return

    const avgWear = (wear.frontLeft + wear.frontRight + wear.rearLeft + wear.rearRight) / 4

    set({
      perWheelWear: wear,
      averageWear: avgWear,
      effectiveGripMultiplier: effectiveGrip,
    })
  },

  syncGripBreakdown: breakdown => {
    set({ gripBreakdown: breakdown })
  },

  syncTireMaterial: material => {
    set({ tireMaterial: material })
  },

  resetWear: () => {
    set({
      perWheelWear: { ...initialPerWheelWear },
      averageWear: 0,
      effectiveGripMultiplier: 1.0,
    })
  },

  setWearDebug: wearPercentage => {
    const clamped = Math.max(0, Math.min(100, wearPercentage))
    const wear: PerWheelWear = {
      frontLeft: clamped,
      frontRight: clamped,
      rearLeft: clamped,
      rearRight: clamped,
    }

    try {
      setTireWearWasm(clamped)
    } catch {
      // WASM may not be initialized yet
    }

    set({
      debugMode: true,
      perWheelWear: wear,
      averageWear: clamped,
    })
  },

  disableDebugMode: () => {
    set({ debugMode: false })
  },

  getTireConfig: () => {
    return TIRE_CONFIG[get().currentCompound]
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
