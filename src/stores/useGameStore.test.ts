import { beforeEach, describe, expect, it } from 'bun:test'
import { useGameStore } from './useGameStore'

describe('useGameStore main screen actions', () => {
  beforeEach(() => {
    useGameStore.setState({
      status: 'menu',
      previewReturnStatus: 'racing',
      isTestingMode: false,
      isSettingsOpen: false,
    })
  })

  it('starts a race session from the main screen', () => {
    useGameStore.getState().startRaceSession()

    const state = useGameStore.getState()
    expect(state.status).toBe('countdown')
    expect(state.isTestingMode).toBe(false)
    expect(state.isSettingsOpen).toBe(false)
  })

  it('starts a test session from the main screen', () => {
    useGameStore.getState().startTestSession()

    const state = useGameStore.getState()
    expect(state.status).toBe('customize')
    expect(state.isTestingMode).toBe(true)
    expect(state.isSettingsOpen).toBe(false)
  })

  it('opens the showroom and returns to menu when exiting preview', () => {
    useGameStore.getState().openShowroom()

    let state = useGameStore.getState()
    expect(state.status).toBe('preview')
    expect(state.previewReturnStatus).toBe('menu')
    expect(state.isTestingMode).toBe(false)

    useGameStore.getState().exitPreviewMode()

    state = useGameStore.getState()
    expect(state.status).toBe('menu')
  })

  it('returns to the main menu and closes settings', () => {
    useGameStore.setState({ status: 'customize', isSettingsOpen: true, isTestingMode: true })

    useGameStore.getState().enterMenu()

    const state = useGameStore.getState()
    expect(state.status).toBe('menu')
    expect(state.isSettingsOpen).toBe(false)
    expect(state.isTestingMode).toBe(false)
  })
})
