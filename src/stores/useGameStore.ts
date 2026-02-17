import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type GameStatus = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'customize'
type CameraMode = 'third-person' | 'first-person' | 'free'

interface GameState {
  status: GameStatus
  cameraMode: CameraMode
  previousCameraMode: CameraMode
  isTestingMode: boolean
  isSettingsOpen: boolean
  lookSensitivity: number

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
  toggleTestingMode: () => void
  toggleSettings: () => void
  closeSettings: () => void
  setLookSensitivity: (sensitivity: number) => void
}

export const useGameStore = create<GameState>()(
  persist(
    set => ({
      status: 'racing',
      cameraMode: 'third-person',
      previousCameraMode: 'third-person',
      isTestingMode: false,
      isSettingsOpen: false,
      lookSensitivity: 0.002,

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
      toggleTestingMode: () => set(state => ({ isTestingMode: !state.isTestingMode })),
      toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),
      closeSettings: () => set({ isSettingsOpen: false }),
      setLookSensitivity: sensitivity => set({ lookSensitivity: sensitivity }),
    }),
    {
      name: 'game-settings',
      partialize: state => ({
        cameraMode: state.cameraMode,
        previousCameraMode: state.previousCameraMode,
        isTestingMode: state.isTestingMode,
        lookSensitivity: state.lookSensitivity,
      }),
    },
  ),
)
