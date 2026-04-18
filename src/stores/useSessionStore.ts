import { create } from 'zustand'
import { useLapTimeStore } from './useLapTimeStore'
import { buildSessionResults } from '@/utils/buildSessionResults'
import {
  DEFAULT_SESSION_CONFIG,
  createSessionConfig,
  type SessionConfig,
  type SessionKind,
  type SessionPhase,
  type SessionResultsSnapshot,
} from '@/types/session'
import type { SessionEvent, SessionEventInput } from '@/types/sessionEvents'

export const isIdleSessionPhase = (phase: SessionPhase) => phase === 'idle'
export const isSetupSessionPhase = (phase: SessionPhase) => phase === 'setup'
export const isCountdownSessionPhase = (phase: SessionPhase) => phase === 'countdown'
export const isRunningSessionPhase = (phase: SessionPhase) => phase === 'running'
export const isPausedSessionPhase = (phase: SessionPhase) => phase === 'paused'
export const isFinishedSessionPhase = (phase: SessionPhase) => phase === 'finished'

interface SessionState {
  phase: SessionPhase
  config: SessionConfig | null
  lastActivePhase: Exclude<SessionPhase, 'idle' | 'paused'> | null
  results: SessionResultsSnapshot | null
  events: SessionEvent[]

  configureSession: (config: Partial<SessionConfig> & Pick<SessionConfig, 'kind'>) => void
  beginSessionFlow: (
    kind: SessionKind,
    options?: Partial<Omit<SessionConfig, 'kind'>>,
  ) => SessionConfig
  startCountdown: () => void
  startQuickSession: (
    kind: SessionKind,
    options?: Partial<Omit<SessionConfig, 'kind'>>,
  ) => SessionConfig
  startSession: () => void
  pauseSession: () => void
  resumeSession: () => void
  recordEvent: (event: SessionEventInput) => SessionEvent
  clearEvents: () => void
  finishSession: (results?: Partial<SessionResultsSnapshot>) => SessionResultsSnapshot | null
  resetSession: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  phase: 'idle',
  config: null,
  lastActivePhase: null,
  results: null,
  events: [],

  configureSession: config =>
    set(state => ({
      config: {
        ...(state.config ?? DEFAULT_SESSION_CONFIG),
        ...config,
      },
      results: null,
    })),

  beginSessionFlow: (kind, options) => {
    const config = createSessionConfig(kind, options)
    set({
      config,
      phase: 'setup',
      lastActivePhase: 'setup',
      results: null,
      events: [],
    })
    return config
  },

  startCountdown: () =>
    set(state => {
      if (!state.config) return state
      return {
        phase: 'countdown',
        lastActivePhase: 'countdown',
        results: null,
        events: [],
      }
    }),

  startQuickSession: (kind, options) => {
    const config = createSessionConfig(kind, options)
    set({
      config,
      phase: 'running',
      lastActivePhase: 'running',
      results: null,
      events: [],
    })
    return config
  },

  startSession: () =>
    set(state => {
      if (!state.config) return state
      return {
        phase: 'running',
        lastActivePhase: 'running',
        results: null,
      }
    }),

  pauseSession: () =>
    set(state => {
      if (state.phase !== 'running') return state
      return {
        phase: 'paused',
        lastActivePhase: 'running',
      }
    }),

  resumeSession: () =>
    set(state => {
      if (state.phase !== 'paused') return state
      return {
        phase: state.lastActivePhase ?? 'running',
      }
    }),

  recordEvent: event => {
    const fullEvent = {
      ...event,
      id: `session-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    } as SessionEvent
    set(state => ({ events: [...state.events, fullEvent] }))
    return fullEvent
  },

  clearEvents: () => set({ events: [] }),

  finishSession: results => {
    const { config, events } = get()
    if (!config) return null

    const lapState = useLapTimeStore.getState()
    const completedAt = Date.now()
    const nextEvents = [
      ...events,
      {
        id: `session-event-${completedAt}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'session_finished' as const,
        at: completedAt,
      },
    ]
    const snapshot: SessionResultsSnapshot = {
      ...buildSessionResults(
        config,
        {
          lapCount: lapState.lapCount,
          bestLapTime: lapState.bestLapTime,
          lastLapTime: lapState.lastLapTime,
        },
        nextEvents,
        completedAt,
      ),
      ...results,
    }

    set({
      phase: 'finished',
      lastActivePhase: 'finished',
      results: snapshot,
      events: nextEvents,
    })

    return snapshot
  },

  resetSession: () =>
    set({
      phase: 'idle',
      config: null,
      lastActivePhase: null,
      results: null,
      events: [],
    }),
}))
