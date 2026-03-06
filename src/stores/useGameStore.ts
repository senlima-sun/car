import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCarStore } from './useCarStore'
import { useActiveAeroStore } from './useActiveAeroStore'

type GameStatus = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'customize' | 'preview'
type CameraMode = 'third-person' | 'first-person' | 'free'
type NonPreviewStatus = Exclude<GameStatus, 'preview'>

interface GameState {
  status: GameStatus
  previewReturnStatus: NonPreviewStatus
  cameraMode: CameraMode
  previousCameraMode: CameraMode
  isTestingMode: boolean
  isSettingsOpen: boolean
  lookSensitivity: number
  showFPS: boolean

  enterMenu: () => void
  startRaceSession: () => void
  startTestSession: () => void
  openShowroom: () => void
  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  finishGame: () => void
  resetGame: () => void
  toggleCameraMode: () => void
  setCameraMode: (mode: CameraMode) => void
  toggleFreeCamera: () => void
  enterCustomizeMode: () => void
  exitCustomizeMode: () => void
  toggleCustomizeMode: () => void
  enterPreviewMode: () => void
  exitPreviewMode: () => void
  togglePreviewMode: () => void
  toggleTestingMode: () => void
  setTestingMode: (enabled: boolean) => void
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
      previewReturnStatus: 'racing',
      cameraMode: 'third-person',
      previousCameraMode: 'third-person',
      isTestingMode: false,
      isSettingsOpen: false,
      lookSensitivity: 0.002,
      showFPS: true,

      enterMenu: () => set({ status: 'menu', isTestingMode: false, isSettingsOpen: false }),
      startRaceSession: () =>
        set({ status: 'countdown', isTestingMode: false, isSettingsOpen: false }),
      startTestSession: () =>
        set({ status: 'customize', isTestingMode: true, isSettingsOpen: false }),
      openShowroom: () =>
        set({
          status: 'preview',
          previewReturnStatus: 'menu',
          isTestingMode: false,
          isSettingsOpen: false,
        }),
      startGame: () => set({ status: 'countdown' }),
      pauseGame: () => set({ status: 'paused' }),
      resumeGame: () => set({ status: 'racing' }),
      finishGame: () => set({ status: 'finished' }),
      resetGame: () => set({ status: 'menu' }),
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
      exitCustomizeMode: () => set({ status: 'racing' }),
      toggleCustomizeMode: () =>
        set(state => ({
          status: state.status === 'customize' ? 'racing' : 'customize',
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
      toggleTestingMode: () => set(state => ({ isTestingMode: !state.isTestingMode })),
      setTestingMode: enabled => set({ isTestingMode: enabled }),
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
