import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCarStore } from './useCarStore'
import { useActiveAeroStore } from './useActiveAeroStore'
import { useSessionStore } from './useSessionStore'

export type GameStatus = 'menu' | 'session' | 'customize' | 'preview'
export type CameraMode = 'third-person' | 'first-person' | 'free'
export type NonPreviewStatus = Exclude<GameStatus, 'preview'>

export const isMenuStatus = (status: GameStatus) => status === 'menu'
export const isSessionShellStatus = (status: GameStatus) => status === 'session'
export const isCustomizeStatus = (status: GameStatus) => status === 'customize'
export const isPreviewStatus = (status: GameStatus) => status === 'preview'

interface GameState {
  status: GameStatus
  previewReturnStatus: NonPreviewStatus
  cameraMode: CameraMode
  previousCameraMode: CameraMode
  isSettingsOpen: boolean
  lookSensitivity: number
  showFPS: boolean

  enterMenu: () => void
  openTrackEditor: () => void
  openShowroom: () => void
  enterSessionShell: () => void
  toggleCameraMode: () => void
  setCameraMode: (mode: CameraMode) => void
  toggleFreeCamera: () => void
  enterCustomizeMode: () => void
  exitCustomizeMode: () => void
  toggleCustomizeMode: () => void
  enterPreviewMode: () => void
  exitPreviewMode: () => void
  togglePreviewMode: () => void
  toggleSettings: () => void
  openSettings: () => void
  closeSettings: () => void
  setLookSensitivity: (sensitivity: number) => void
  toggleShowFPS: () => void
}

export const useGameStore = create<GameState>()(
  persist(
    set => ({
      status: 'menu',
      previewReturnStatus: 'session',
      cameraMode: 'third-person',
      previousCameraMode: 'third-person',
      isSettingsOpen: false,
      lookSensitivity: 0.002,
      showFPS: true,

      enterMenu: () => {
        useSessionStore.getState().resetSession()
        set({ status: 'menu', isSettingsOpen: false })
      },
      openTrackEditor: () => {
        const session = useSessionStore.getState()
        session.resetSession()
        session.configureSession({ kind: 'practice', testingMode: true })
        set({ status: 'customize', isSettingsOpen: false })
      },
      openShowroom: () =>
        set({
          status: 'preview',
          previewReturnStatus: 'menu',
          isSettingsOpen: false,
        }),
      enterSessionShell: () => set({ status: 'session', isSettingsOpen: false }),
      toggleCameraMode: () =>
        set(state => ({
          cameraMode: state.cameraMode === 'third-person' ? 'first-person' : 'third-person',
        })),
      setCameraMode: mode => set({ cameraMode: mode }),
      toggleFreeCamera: () =>
        set(state => {
          if (state.cameraMode === 'free') {
            return { cameraMode: state.previousCameraMode }
          }
          return { previousCameraMode: state.cameraMode, cameraMode: 'free' }
        }),
      enterCustomizeMode: () => set({ status: 'customize' }),
      exitCustomizeMode: () => set({ status: 'session' }),
      toggleCustomizeMode: () =>
        set(state => ({
          status: state.status === 'customize' ? 'session' : 'customize',
        })),
      enterPreviewMode: () => {
        useActiveAeroStore.setState({ frontWingAngle: 0, rearWingAngle: 0 })
        useCarStore.getState().updateTelemetry({ steerAngle: 0, wheelRotations: [0, 0, 0, 0] })
        set(state => ({
          previewReturnStatus:
            state.status === 'preview' ? state.previewReturnStatus : state.status,
          status: 'preview',
        }))
      },
      exitPreviewMode: () => {
        useActiveAeroStore.setState({ frontWingAngle: 0, rearWingAngle: 0 })
        useCarStore.getState().updateTelemetry({ steerAngle: 0, wheelRotations: [0, 0, 0, 0] })
        set(state => ({ status: state.previewReturnStatus }))
      },
      togglePreviewMode: () =>
        set(state => {
          if (state.status === 'preview') {
            useActiveAeroStore.setState({ frontWingAngle: 0, rearWingAngle: 0 })
            useCarStore.getState().updateTelemetry({ steerAngle: 0, wheelRotations: [0, 0, 0, 0] })
            return { status: state.previewReturnStatus }
          }
          useActiveAeroStore.setState({ frontWingAngle: 0, rearWingAngle: 0 })
          useCarStore.getState().updateTelemetry({ steerAngle: 0, wheelRotations: [0, 0, 0, 0] })
          return {
            previewReturnStatus: state.status,
            status: 'preview',
          }
        }),
      toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      setLookSensitivity: sensitivity => set({ lookSensitivity: sensitivity }),
      toggleShowFPS: () => set(state => ({ showFPS: !state.showFPS })),
    }),
    {
      name: 'game-settings',
      partialize: state => ({
        cameraMode: state.cameraMode,
        previousCameraMode: state.previousCameraMode,
        lookSensitivity: state.lookSensitivity,
        showFPS: state.showFPS,
      }),
    },
  ),
)
