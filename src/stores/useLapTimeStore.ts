import { create } from 'zustand'

const CROSSING_COOLDOWN_MS = 2000
const WRONG_WAY_DISMISS_MS = 3000

interface LapTimeState {
  isActive: boolean
  isRecording: boolean

  currentLapStart: number | null
  currentLapTime: number
  lastLapTime: number | null
  bestLapTime: number | null
  lapCount: number
  lastCrossingTime: number

  wrongWay: boolean
  currentLapInvalid: boolean

  setActive: (active: boolean) => void
  toggleRecording: () => void
  crossCheckpoint: (isWrongWay?: boolean) => void
  updateCurrentTime: () => void
  setWrongWay: (wrongWay: boolean) => void
  reset: () => void
}

export const useLapTimeStore = create<LapTimeState>((set, get) => ({
  isActive: false,
  isRecording: false,
  currentLapStart: null,
  currentLapTime: 0,
  lastLapTime: null,
  bestLapTime: null,
  lapCount: 0,
  lastCrossingTime: 0,
  wrongWay: false,
  currentLapInvalid: false,

  setActive: active => {
    if (!active) {
      set({
        isActive: false,
        isRecording: false,
        currentLapStart: null,
        currentLapTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapCount: 0,
        lastCrossingTime: 0,
        wrongWay: false,
        currentLapInvalid: false,
      })
    } else {
      set({ isActive: true })
    }
  },

  toggleRecording: () => {
    const state = get()
    if (!state.isActive) return

    if (state.isRecording) {
      set({
        isRecording: false,
        currentLapStart: null,
        currentLapTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapCount: 0,
        lastCrossingTime: 0,
        wrongWay: false,
        currentLapInvalid: false,
      })
    } else {
      set({ isRecording: true })
    }
  },

  crossCheckpoint: (isWrongWay = false) => {
    const state = get()
    if (!state.isActive || !state.isRecording) return

    if (isWrongWay) {
      set({ wrongWay: true, currentLapInvalid: true })
      setTimeout(() => {
        if (get().wrongWay) {
          set({ wrongWay: false })
        }
      }, WRONG_WAY_DISMISS_MS)
      return
    }

    const now = performance.now()

    if (now - state.lastCrossingTime < CROSSING_COOLDOWN_MS) return

    if (state.currentLapStart === null) {
      set({
        currentLapStart: now,
        currentLapTime: 0,
        lastCrossingTime: now,
        currentLapInvalid: false,
      })
    } else {
      const lapTime = now - state.currentLapStart

      if (!state.currentLapInvalid) {
        const newBest =
          state.bestLapTime === null || lapTime < state.bestLapTime ? lapTime : state.bestLapTime
        set({
          lastLapTime: lapTime,
          bestLapTime: newBest,
          lapCount: state.lapCount + 1,
          currentLapStart: now,
          currentLapTime: 0,
          lastCrossingTime: now,
          currentLapInvalid: false,
        })
      } else {
        set({
          lastLapTime: null,
          lapCount: state.lapCount + 1,
          currentLapStart: now,
          currentLapTime: 0,
          lastCrossingTime: now,
          currentLapInvalid: false,
        })
      }
    }
  },

  updateCurrentTime: () => {
    const state = get()
    if (!state.isActive || !state.isRecording || state.currentLapStart === null) return

    const now = performance.now()
    set({ currentLapTime: now - state.currentLapStart })
  },

  setWrongWay: (wrongWay) => {
    set({ wrongWay })
    if (wrongWay) {
      set({ currentLapInvalid: true })
      setTimeout(() => {
        if (get().wrongWay) {
          set({ wrongWay: false })
        }
      }, WRONG_WAY_DISMISS_MS)
    }
  },

  reset: () =>
    set({
      isRecording: false,
      currentLapStart: null,
      currentLapTime: 0,
      lastLapTime: null,
      bestLapTime: null,
      lapCount: 0,
      lastCrossingTime: 0,
      wrongWay: false,
      currentLapInvalid: false,
    }),
}))
