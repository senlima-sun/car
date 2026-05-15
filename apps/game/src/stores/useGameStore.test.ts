import { beforeEach, describe, expect, it } from 'bun:test'
import {
  isCustomizeStatus,
  isMenuStatus,
  isPreviewStatus,
  isSessionShellStatus,
  useGameStore,
} from './useGameStore'
import { useSessionStore } from './useSessionStore'

describe('useGameStore main screen actions', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession()
    useGameStore.setState({
      status: 'menu',
      previewReturnStatus: 'session',
      isSettingsOpen: false,
    })
  })

  it('opens the session shell from the main screen', () => {
    useGameStore.getState().enterSessionShell()

    const state = useGameStore.getState()
    expect(state.status).toBe('session')
    expect(state.isSettingsOpen).toBe(false)
  })

  it('opens the track editor from the main screen', () => {
    useGameStore.getState().openTrackEditor()

    const state = useGameStore.getState()
    expect(state.status).toBe('customize')
    expect(state.isSettingsOpen).toBe(false)
    expect(useSessionStore.getState().phase).toBe('idle')
    expect(useSessionStore.getState().config?.testingMode).toBe(true)
  })

  it('opens the showroom and returns to menu when exiting preview', () => {
    useGameStore.getState().openShowroom()

    let state = useGameStore.getState()
    expect(state.status).toBe('preview')
    expect(state.previewReturnStatus).toBe('menu')

    useGameStore.getState().exitPreviewMode()

    state = useGameStore.getState()
    expect(state.status).toBe('menu')
  })

  it('returns to the main menu and closes settings', () => {
    useSessionStore.getState().startQuickSession('race')
    useGameStore.setState({ status: 'customize', isSettingsOpen: true })

    useGameStore.getState().enterMenu()

    const state = useGameStore.getState()
    expect(state.status).toBe('menu')
    expect(state.isSettingsOpen).toBe(false)
    expect(useSessionStore.getState().phase).toBe('idle')
  })

  it('exposes shell status helpers for app composition', () => {
    expect(isMenuStatus('menu')).toBe(true)
    expect(isSessionShellStatus('session')).toBe(true)
    expect(isCustomizeStatus('customize')).toBe(true)
    expect(isPreviewStatus('preview')).toBe(true)
    expect(isSessionShellStatus('menu')).toBe(false)
  })

  it('cycles camera modes through third-person, first-person, top-down', () => {
    useGameStore.setState({ cameraMode: 'third-person' })
    useGameStore.getState().toggleCameraMode()
    expect(useGameStore.getState().cameraMode).toBe('first-person')
    useGameStore.getState().toggleCameraMode()
    expect(useGameStore.getState().cameraMode).toBe('top-down')
    useGameStore.getState().toggleCameraMode()
    expect(useGameStore.getState().cameraMode).toBe('third-person')
  })

  it('toggle camera mode resets free camera into the cycle', () => {
    useGameStore.setState({ cameraMode: 'free' })
    useGameStore.getState().toggleCameraMode()
    expect(useGameStore.getState().cameraMode).toBe('third-person')
  })
})
