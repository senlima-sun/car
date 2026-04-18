import { beforeEach, describe, expect, it } from 'bun:test'
import {
  isCountdownSessionPhase,
  isFinishedSessionPhase,
  isPausedSessionPhase,
  isRunningSessionPhase,
  isSetupSessionPhase,
  useSessionStore,
} from './useSessionStore'
import { useLapTimeStore } from './useLapTimeStore'

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession()
    useLapTimeStore.setState({
      bestLapTime: null,
      lastLapTime: null,
      lapCount: 0,
    })
  })

  it('starts a quick race session with runtime defaults', () => {
    const config = useSessionStore.getState().startQuickSession('race')

    const state = useSessionStore.getState()
    expect(state.phase).toBe('running')
    expect(config.kind).toBe('race')
    expect(config.gridSize).toBe(10)
    expect(config.testingMode).toBe(false)
  })

  it('records typed session events', () => {
    const event = useSessionStore
      .getState()
      .recordEvent({ type: 'session_started', at: 1000 })

    const state = useSessionStore.getState()
    expect(state.events).toHaveLength(1)
    expect(state.events[0]?.id).toBe(event.id)
    expect(state.events[0]?.type).toBe('session_started')
  })

  it('begins a session flow in setup before countdown', () => {
    const config = useSessionStore.getState().beginSessionFlow('race')

    const state = useSessionStore.getState()
    expect(state.phase).toBe('setup')
    expect(config.kind).toBe('race')
    expect(config.trackId).toBe('silverstone')
  })

  it('transitions from setup into countdown', () => {
    useSessionStore.getState().beginSessionFlow('practice', { testingMode: true })
    useSessionStore.getState().startCountdown()

    const state = useSessionStore.getState()
    expect(state.phase).toBe('countdown')
    expect(state.config?.testingMode).toBe(true)
  })

  it('starts a quick practice session in testing mode', () => {
    const config = useSessionStore
      .getState()
      .startQuickSession('practice', { testingMode: true, lapLimit: 12 })

    const state = useSessionStore.getState()
    expect(state.phase).toBe('running')
    expect(config.testingMode).toBe(true)
    expect(config.lapLimit).toBe(12)
    expect(state.config?.kind).toBe('practice')
  })

  it('pauses and resumes a running session', () => {
    useSessionStore.getState().startQuickSession('practice')
    useSessionStore.getState().pauseSession()
    expect(useSessionStore.getState().phase).toBe('paused')

    useSessionStore.getState().resumeSession()
    expect(useSessionStore.getState().phase).toBe('running')
  })

  it('builds a finish snapshot from lap state', () => {
    useSessionStore.getState().startQuickSession('qualifying', { testingMode: true })
    useSessionStore
      .getState()
      .recordEvent({ type: 'track_limits_violation', at: 100, violationCount: 1, totalViolationTime: 500 })
    useLapTimeStore.setState({
      bestLapTime: 91234,
      lastLapTime: 92500,
      lapCount: 4,
    })

    const snapshot = useSessionStore.getState().finishSession()

    expect(snapshot).not.toBeNull()
    expect(snapshot?.kind).toBe('qualifying')
    expect(snapshot?.trackId).toBe('silverstone')
    expect(snapshot?.lapCount).toBe(4)
    expect(snapshot?.bestLapTime).toBe(91234)
    expect(snapshot?.testingMode).toBe(true)
    expect(snapshot?.trackLimitsViolations).toBe(1)
    expect(snapshot?.eventCount).toBe(2)
    expect(useSessionStore.getState().phase).toBe('finished')
  })

  it('exposes runtime phase helpers for shell wiring', () => {
    expect(isSetupSessionPhase('setup')).toBe(true)
    expect(isCountdownSessionPhase('countdown')).toBe(true)
    expect(isRunningSessionPhase('running')).toBe(true)
    expect(isPausedSessionPhase('paused')).toBe(true)
    expect(isFinishedSessionPhase('finished')).toBe(true)
    expect(isRunningSessionPhase('idle')).toBe(false)
  })
})
