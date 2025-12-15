import { create } from 'zustand'

// Minimum time between checkpoint crossings (prevents double-triggers)
const CROSSING_COOLDOWN_MS = 2000

interface LapTimeState {
  // System state
  isActive: boolean // True when checkpoints exist
  isRecording: boolean // True when user has enabled recording (R key)

  // Timing data
  currentLapStart: number | null // performance.now() timestamp
  currentLapTime: number // Live elapsed time (ms)
  lastLapTime: number | null // Most recent completed lap (ms)
  bestLapTime: number | null // Session best (ms)
  lapCount: number // Completed laps
  lastCrossingTime: number // Timestamp of last crossing (for debounce)

  // Actions
  setActive: (active: boolean) => void
  toggleRecording: () => void // Toggle recording on/off (R key)
  crossCheckpoint: () => void // Called when car crosses checkpoint
  updateCurrentTime: () => void // Called each frame to update live timing
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

  setActive: active => {
    if (!active) {
      // Reset timing when deactivated
      set({
        isActive: false,
        isRecording: false,
        currentLapStart: null,
        currentLapTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapCount: 0,
        lastCrossingTime: 0,
      })
    } else {
      set({ isActive: true })
    }
  },

  toggleRecording: () => {
    const state = get()
    console.log('toggleRecording called', {
      isActive: state.isActive,
      isRecording: state.isRecording,
    })

    if (!state.isActive) {
      console.log('toggleRecording ignored - no checkpoints')
      return // Can't record without checkpoints
    }

    if (state.isRecording) {
      // Stop recording - reset timing data
      console.log('Stopping recording')
      set({
        isRecording: false,
        currentLapStart: null,
        currentLapTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapCount: 0,
        lastCrossingTime: 0,
      })
    } else {
      // Start recording
      console.log('Starting recording')
      set({ isRecording: true })
    }
  },

  crossCheckpoint: () => {
    const state = get()
    console.log('crossCheckpoint called', {
      isActive: state.isActive,
      isRecording: state.isRecording,
    })

    if (!state.isActive || !state.isRecording) {
      console.log('crossCheckpoint ignored - not active or not recording')
      return
    }

    const now = performance.now()

    // Debounce: ignore crossings within cooldown period
    if (now - state.lastCrossingTime < CROSSING_COOLDOWN_MS) {
      console.log('crossCheckpoint ignored - cooldown')
      return
    }

    if (state.currentLapStart === null) {
      // First crossing - start the first lap
      console.log('Starting first lap')
      set({
        currentLapStart: now,
        currentLapTime: 0,
        lastCrossingTime: now,
      })
    } else {
      // Complete the current lap and start a new one
      const lapTime = now - state.currentLapStart
      const newBest =
        state.bestLapTime === null || lapTime < state.bestLapTime ? lapTime : state.bestLapTime

      console.log('Lap completed', { lapTime, newBest, lapCount: state.lapCount + 1 })
      set({
        lastLapTime: lapTime,
        bestLapTime: newBest,
        lapCount: state.lapCount + 1,
        currentLapStart: now,
        currentLapTime: 0,
        lastCrossingTime: now,
      })
    }
  },

  updateCurrentTime: () => {
    const state = get()
    if (!state.isActive || !state.isRecording || state.currentLapStart === null) return

    const now = performance.now()
    set({ currentLapTime: now - state.currentLapStart })
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
    }),
}))
