import { create } from 'zustand'
import type { TelemetryRingBuffer, TelemetryLap } from '../telemetry/TelemetryRingBuffer'

const MAX_COMPLETED_LAPS = 10

interface TelemetryState {
  isRecording: boolean
  isOverlayVisible: boolean
  completedLaps: TelemetryLap[]
  selectedLapIndex: number | null
  comparisonLapIndex: number | null
  analysisOpen: boolean
  bufferRef: { current: TelemetryRingBuffer } | null

  setRecording: (recording: boolean) => void
  toggleOverlay: () => void
  addCompletedLap: (lap: TelemetryLap) => void
  setSelectedLap: (index: number | null) => void
  setComparisonLap: (index: number | null) => void
  setAnalysisOpen: (open: boolean) => void
  toggleAnalysis: () => void
  clearLaps: () => void
  setBufferRef: (ref: { current: TelemetryRingBuffer }) => void
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  isRecording: true,
  isOverlayVisible: false,
  completedLaps: [],
  selectedLapIndex: null,
  comparisonLapIndex: null,
  analysisOpen: false,
  bufferRef: null,

  setRecording: recording => set({ isRecording: recording }),

  toggleOverlay: () => set(s => ({ isOverlayVisible: !s.isOverlayVisible })),

  addCompletedLap: lap => {
    const laps = [...get().completedLaps, lap]
    if (laps.length > MAX_COMPLETED_LAPS) laps.shift()
    set({ completedLaps: laps })
  },

  setSelectedLap: index => set({ selectedLapIndex: index }),

  setComparisonLap: index => set({ comparisonLapIndex: index }),

  setAnalysisOpen: open => set({ analysisOpen: open }),

  toggleAnalysis: () => set(s => ({ analysisOpen: !s.analysisOpen })),

  clearLaps: () =>
    set({
      completedLaps: [],
      selectedLapIndex: null,
      comparisonLapIndex: null,
    }),

  setBufferRef: ref => set({ bufferRef: ref }),
}))
