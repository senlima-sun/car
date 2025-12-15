import { create } from 'zustand'

type GameStatus = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'customize'
type CameraMode = 'third-person' | 'first-person'

interface GameState {
  status: GameStatus
  cameraMode: CameraMode

  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  finishGame: () => void
  resetGame: () => void
  toggleCameraMode: () => void
  setCameraMode: (mode: CameraMode) => void
  enterCustomizeMode: () => void
  exitCustomizeMode: () => void
  toggleCustomizeMode: () => void
}

export const useGameStore = create<GameState>(set => ({
  status: 'racing',
  cameraMode: 'third-person',

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
  enterCustomizeMode: () => set({ status: 'customize' }),
  exitCustomizeMode: () => set({ status: 'racing' }),
  toggleCustomizeMode: () =>
    set(state => ({
      status: state.status === 'customize' ? 'racing' : 'customize',
    })),
}))
