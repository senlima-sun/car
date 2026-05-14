import { create } from 'zustand'
import { TireCompound } from '../constants/tires'

export const PIT_LANE_SPEED_LIMIT_KMH = 80
export const PIT_LANE_SPEED_LIMIT_MS = PIT_LANE_SPEED_LIMIT_KMH / 3.6
export const PIT_LANE_PENALTY_SECONDS = 3

export interface PitStopResult {
  tire: TireCompound | null
  ersCharge: boolean
}

interface PitState {
  isInPitLane: boolean
  isInPitBox: boolean
  isPitStopActive: boolean

  selectedNewTire: TireCompound | null
  ersChargeSelected: boolean

  pitStopSpeedThreshold: number

  pitLaneSpeedingPenalty: number
  isPitLaneSpeeding: boolean

  enterPitLane: () => void
  exitPitLane: () => void
  enterPitBox: () => void
  exitPitBox: () => void
  selectTire: (compound: TireCompound) => void
  toggleErsCharge: () => void
  startPitStop: () => boolean
  completePitStop: () => PitStopResult
  cancelPitStop: () => void
  clearPitLane: () => void
  checkPitLaneSpeed: (speedMs: number) => void
  clearPenalty: () => void
}

export const usePitStore = create<PitState>((set, get) => ({
  isInPitLane: false,
  isInPitBox: false,
  isPitStopActive: false,
  selectedNewTire: null,
  ersChargeSelected: false,
  pitStopSpeedThreshold: 2,
  pitLaneSpeedingPenalty: 0,
  isPitLaneSpeeding: false,

  enterPitLane: () => set({ isInPitLane: true }),

  exitPitLane: () =>
    set({
      isInPitLane: false,
      isInPitBox: false,
      isPitStopActive: false,
      selectedNewTire: null,
      ersChargeSelected: false,
      isPitLaneSpeeding: false,
    }),

  enterPitBox: () => set({ isInPitBox: true }),

  exitPitBox: () =>
    set({
      isInPitBox: false,
      isPitStopActive: false,
      selectedNewTire: null,
      ersChargeSelected: false,
    }),

  selectTire: compound => set({ selectedNewTire: compound }),

  toggleErsCharge: () => set(s => ({ ersChargeSelected: !s.ersChargeSelected })),

  startPitStop: () => {
    const state = get()
    if (state.isInPitBox && !state.isPitStopActive) {
      set({ isPitStopActive: true })
      return true
    }
    return false
  },

  completePitStop: () => {
    const state = get()
    const hasWork = state.isPitStopActive && (state.selectedNewTire || state.ersChargeSelected)
    if (hasWork) {
      const result: PitStopResult = {
        tire: state.selectedNewTire,
        ersCharge: state.ersChargeSelected,
      }
      set({
        isPitStopActive: false,
        selectedNewTire: null,
        ersChargeSelected: false,
      })
      return result
    }
    return { tire: null, ersCharge: false }
  },

  cancelPitStop: () =>
    set({
      isPitStopActive: false,
      selectedNewTire: null,
      ersChargeSelected: false,
    }),

  clearPitLane: () =>
    set({
      isInPitLane: false,
      isInPitBox: false,
      isPitStopActive: false,
      selectedNewTire: null,
      ersChargeSelected: false,
      pitLaneSpeedingPenalty: 0,
      isPitLaneSpeeding: false,
    }),

  checkPitLaneSpeed: (speedMs: number) => {
    const state = get()
    if (!state.isInPitLane) return
    const isSpeeding = speedMs > PIT_LANE_SPEED_LIMIT_MS
    if (isSpeeding && !state.isPitLaneSpeeding) {
      set({
        isPitLaneSpeeding: true,
        pitLaneSpeedingPenalty: state.pitLaneSpeedingPenalty + PIT_LANE_PENALTY_SECONDS,
      })
    } else if (!isSpeeding && state.isPitLaneSpeeding) {
      set({ isPitLaneSpeeding: false })
    }
  },

  clearPenalty: () => set({ pitLaneSpeedingPenalty: 0, isPitLaneSpeeding: false }),
}))
