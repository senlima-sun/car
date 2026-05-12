import { create } from 'zustand'

export type ValidationDrivePhase =
  | 'idle'
  | 'arming'
  | 'driving'
  | 'completed'
  | 'failed'

export interface ValidationCenterlineSample {
  x: number
  z: number
  cumulativeDistance: number
}

export interface ValidationRunSummary {
  trackId: string
  phase: 'completed' | 'failed'
  lapTimeSeconds: number | null
  offTrackSeconds: number
  failureReason: string | null
  replayId: string | null
}

interface ValidationDriveState {
  enabled: boolean
  phase: ValidationDrivePhase
  trackId: string | null
  failureReason: string | null
  startedAt: number | null
  completedAt: number | null
  lapTimeSeconds: number | null
  offTrackSeconds: number
  centerlineSamples: ValidationCenterlineSample[] | null
  summary: ValidationRunSummary | null

  start: (trackId: string, centerlineSamples: ValidationCenterlineSample[]) => void
  complete: (lapTimeSeconds: number, replayId: string | null) => void
  abort: (reason: string) => void
  tickOffTrack: (deltaSeconds: number) => void
  reset: () => void
}

const initialState = {
  enabled: false,
  phase: 'idle' as ValidationDrivePhase,
  trackId: null,
  failureReason: null,
  startedAt: null,
  completedAt: null,
  lapTimeSeconds: null,
  offTrackSeconds: 0,
  centerlineSamples: null,
  summary: null,
}

export const useValidationDriveStore = create<ValidationDriveState>(set => ({
  ...initialState,

  start: (trackId, centerlineSamples) => {
    const now = performance.now()
    set({
      enabled: true,
      phase: 'driving',
      trackId,
      centerlineSamples,
      startedAt: now,
      completedAt: null,
      lapTimeSeconds: null,
      offTrackSeconds: 0,
      failureReason: null,
      summary: null,
    })
  },

  complete: (lapTimeSeconds, replayId) => {
    set(state => {
      if (state.phase !== 'driving') return state
      const summary: ValidationRunSummary = {
        trackId: state.trackId ?? 'unknown',
        phase: 'completed',
        lapTimeSeconds,
        offTrackSeconds: state.offTrackSeconds,
        failureReason: null,
        replayId,
      }
      return {
        phase: 'completed',
        completedAt: performance.now(),
        lapTimeSeconds,
        summary,
      }
    })
  },

  abort: reason => {
    set(state => {
      if (state.phase === 'completed' || state.phase === 'failed') return state
      const summary: ValidationRunSummary = {
        trackId: state.trackId ?? 'unknown',
        phase: 'failed',
        lapTimeSeconds: null,
        offTrackSeconds: state.offTrackSeconds,
        failureReason: reason,
        replayId: null,
      }
      return {
        phase: 'failed',
        failureReason: reason,
        completedAt: performance.now(),
        summary,
      }
    })
  },

  tickOffTrack: deltaSeconds => {
    set(state => {
      if (state.phase !== 'driving') return state
      return { offTrackSeconds: state.offTrackSeconds + deltaSeconds }
    })
  },

  reset: () => {
    set({ ...initialState })
  },
}))
