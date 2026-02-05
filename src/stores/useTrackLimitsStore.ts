import { create } from 'zustand'

// Track limits violation tracking
// Detects when car's center leaves the road surface

interface TrackLimitsState {
  // Current violation status
  isOffTrack: boolean

  // Statistics for potential penalty system
  violationCount: number
  currentViolationStart: number | null // timestamp when violation started
  totalViolationTime: number // accumulated time off track (ms)

  // Actions
  setOffTrack: (isOff: boolean) => void
  reset: () => void
}

export const useTrackLimitsStore = create<TrackLimitsState>((set, get) => ({
  isOffTrack: false,
  violationCount: 0,
  currentViolationStart: null,
  totalViolationTime: 0,

  setOffTrack: (isOff: boolean) => {
    const state = get()
    const now = Date.now()

    if (isOff && !state.isOffTrack) {
      // Entering off-track: start timing, increment count
      set({
        isOffTrack: true,
        violationCount: state.violationCount + 1,
        currentViolationStart: now,
      })
    } else if (!isOff && state.isOffTrack) {
      // Returning to track: stop timing, accumulate time
      const violationDuration = state.currentViolationStart
        ? now - state.currentViolationStart
        : 0

      set({
        isOffTrack: false,
        currentViolationStart: null,
        totalViolationTime: state.totalViolationTime + violationDuration,
      })
    }
  },

  reset: () => {
    set({
      isOffTrack: false,
      violationCount: 0,
      currentViolationStart: null,
      totalViolationTime: 0,
    })
  },
}))
