import { beforeEach, describe, expect, it } from 'vitest'
import { useTrackLimitsStore } from './useTrackLimitsStore'

describe('useTrackLimitsStore', () => {
  beforeEach(() => {
    useTrackLimitsStore.getState().reset()
  })

  it('bouncing within ribbon does not trigger off-track', () => {
    const { setOffTrack } = useTrackLimitsStore.getState()
    for (let i = 0; i < 100; i++) {
      setOffTrack(false)
    }
    const state = useTrackLimitsStore.getState()
    expect(state.isOffTrack).toBe(false)
    expect(state.violationCount).toBe(0)
    expect(state.totalViolationTime).toBe(0)
  })

  it('only counts a single violation while continuously off-track', () => {
    const { setOffTrack } = useTrackLimitsStore.getState()
    setOffTrack(true)
    for (let i = 0; i < 50; i++) {
      setOffTrack(true)
    }
    expect(useTrackLimitsStore.getState().violationCount).toBe(1)
    expect(useTrackLimitsStore.getState().isOffTrack).toBe(true)
  })

  it('accumulates a fresh violation after returning to track', () => {
    const { setOffTrack } = useTrackLimitsStore.getState()
    setOffTrack(true)
    setOffTrack(false)
    setOffTrack(true)
    expect(useTrackLimitsStore.getState().violationCount).toBe(2)
  })

  it('reset clears all violation state', () => {
    const { setOffTrack, reset } = useTrackLimitsStore.getState()
    setOffTrack(true)
    setOffTrack(false)
    setOffTrack(true)
    reset()
    const state = useTrackLimitsStore.getState()
    expect(state.isOffTrack).toBe(false)
    expect(state.violationCount).toBe(0)
    expect(state.currentViolationStart).toBeNull()
    expect(state.totalViolationTime).toBe(0)
  })
})
