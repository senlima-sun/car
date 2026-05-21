import { beforeEach, describe, expect, it } from 'vitest'
import { useGhostPreferenceStore } from './useGhostPreferenceStore'

describe('useGhostPreferenceStore', () => {
  beforeEach(() => {
    useGhostPreferenceStore.setState({
      preferAiGhost: false,
      spectatorMode: false,
      spectatorLapStart: null,
    })
  })

  it('toggles preferAiGhost', () => {
    useGhostPreferenceStore.getState().toggle()
    expect(useGhostPreferenceStore.getState().preferAiGhost).toBe(true)
    useGhostPreferenceStore.getState().toggle()
    expect(useGhostPreferenceStore.getState().preferAiGhost).toBe(false)
  })

  it('enabling spectator mode sets lap start and forces preferAiGhost', () => {
    const before = performance.now()
    useGhostPreferenceStore.getState().setSpectatorMode(true)
    const state = useGhostPreferenceStore.getState()
    expect(state.spectatorMode).toBe(true)
    expect(state.preferAiGhost).toBe(true)
    expect(state.spectatorLapStart).not.toBeNull()
    expect(state.spectatorLapStart!).toBeGreaterThanOrEqual(before)
  })

  it('disabling spectator mode clears lap start but leaves preferAiGhost', () => {
    useGhostPreferenceStore.getState().setSpectatorMode(true)
    expect(useGhostPreferenceStore.getState().preferAiGhost).toBe(true)
    useGhostPreferenceStore.getState().setSpectatorMode(false)
    const state = useGhostPreferenceStore.getState()
    expect(state.spectatorMode).toBe(false)
    expect(state.spectatorLapStart).toBeNull()
    expect(state.preferAiGhost).toBe(true)
  })

  it('setSpectatorLapStart updates the lap start directly', () => {
    useGhostPreferenceStore.getState().setSpectatorLapStart(12345)
    expect(useGhostPreferenceStore.getState().spectatorLapStart).toBe(12345)
    useGhostPreferenceStore.getState().setSpectatorLapStart(null)
    expect(useGhostPreferenceStore.getState().spectatorLapStart).toBeNull()
  })

  it('preserves existing lap start when toggling spectator on twice', () => {
    useGhostPreferenceStore.setState({ spectatorLapStart: 999 })
    useGhostPreferenceStore.getState().setSpectatorMode(true)
    expect(useGhostPreferenceStore.getState().spectatorLapStart).toBe(999)
  })
})
