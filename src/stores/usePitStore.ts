import { create } from 'zustand'
import { TireCompound } from '../constants/tires'

// Pit lane data structure
export interface PitLaneData {
  // Entry point where pit lane branches from main track
  entryPoint: [number, number, number]
  // Exit point where pit lane merges back to main track
  exitPoint: [number, number, number]
  // Center of the pit box (where car stops for tire change)
  pitBoxCenter: [number, number, number]
  // Pit lane rotation (matches track direction)
  rotation: number
  // Dimensions
  pitBoxLength: number
  pitBoxWidth: number
  // Road segment connecting entry to pit box
  entryRoadStart: [number, number, number]
  entryRoadEnd: [number, number, number]
  // Road segment connecting pit box to exit
  exitRoadStart: [number, number, number]
  exitRoadEnd: [number, number, number]
  // Curved connection data (for bezier curves from main road)
  entryAttachmentPoint?: [number, number, number]
  entryControlPoint?: [number, number, number]
  pitBoxEntry?: [number, number, number] // Where entry curve meets pit box
  exitAttachmentPoint?: [number, number, number]
  exitControlPoint?: [number, number, number]
  pitBoxExit?: [number, number, number] // Where exit curve leaves pit box
  parentRoadDirection?: [number, number, number]
  attachmentSide?: 'left' | 'right'
}

export const PIT_LANE_SPEED_LIMIT_KMH = 80
export const PIT_LANE_SPEED_LIMIT_MS = PIT_LANE_SPEED_LIMIT_KMH / 3.6 // ~22.2 m/s
export const PIT_LANE_PENALTY_SECONDS = 3

interface PitState {
  // Pit lane configuration (null if not generated)
  pitLaneData: PitLaneData | null

  // Current pit state
  isInPitLane: boolean
  isInPitBox: boolean
  isPitStopActive: boolean

  // Selected tire for pit stop
  selectedNewTire: TireCompound | null

  // Speed threshold for pit stop (must be nearly stopped)
  pitStopSpeedThreshold: number

  // Pit lane speed limit penalty
  pitLaneSpeedingPenalty: number // accumulated penalty in seconds
  isPitLaneSpeeding: boolean // currently exceeding speed limit

  // Actions
  setPitLaneData: (data: PitLaneData | null) => void
  enterPitLane: () => void
  exitPitLane: () => void
  enterPitBox: () => void
  exitPitBox: () => void
  selectTire: (compound: TireCompound) => void
  startPitStop: () => boolean
  completePitStop: () => TireCompound | null
  cancelPitStop: () => void
  clearPitLane: () => void
  checkPitLaneSpeed: (speedMs: number) => void
  clearPenalty: () => void
}

export const usePitStore = create<PitState>((set, get) => ({
  pitLaneData: null,
  isInPitLane: false,
  isInPitBox: false,
  isPitStopActive: false,
  selectedNewTire: null,
  pitStopSpeedThreshold: 2, // Must be below 2 m/s (~7 km/h) to pit
  pitLaneSpeedingPenalty: 0,
  isPitLaneSpeeding: false,

  setPitLaneData: data => set({ pitLaneData: data }),

  enterPitLane: () => set({ isInPitLane: true }),

  exitPitLane: () =>
    set({
      isInPitLane: false,
      isInPitBox: false,
      isPitStopActive: false,
      selectedNewTire: null,
      isPitLaneSpeeding: false,
    }),

  enterPitBox: () => set({ isInPitBox: true }),

  exitPitBox: () =>
    set({
      isInPitBox: false,
      isPitStopActive: false,
      selectedNewTire: null,
    }),

  selectTire: compound => set({ selectedNewTire: compound }),

  startPitStop: () => {
    const state = get()
    // Can only start pit stop when in pit box and not already active
    if (state.isInPitBox && !state.isPitStopActive) {
      set({ isPitStopActive: true })
      return true
    }
    return false
  },

  completePitStop: () => {
    const state = get()
    if (state.isPitStopActive && state.selectedNewTire) {
      const newTire = state.selectedNewTire
      set({
        isPitStopActive: false,
        selectedNewTire: null,
      })
      return newTire
    }
    return null
  },

  cancelPitStop: () =>
    set({
      isPitStopActive: false,
      selectedNewTire: null,
    }),

  clearPitLane: () =>
    set({
      pitLaneData: null,
      isInPitLane: false,
      isInPitBox: false,
      isPitStopActive: false,
      selectedNewTire: null,
      pitLaneSpeedingPenalty: 0,
      isPitLaneSpeeding: false,
    }),

  checkPitLaneSpeed: (speedMs: number) => {
    const state = get()
    if (!state.isInPitLane) return
    const isSpeeding = speedMs > PIT_LANE_SPEED_LIMIT_MS
    if (isSpeeding && !state.isPitLaneSpeeding) {
      // Just started speeding - add penalty
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
