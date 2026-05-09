import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCarStore } from './useCarStore'
import { useActiveAeroStore } from './useActiveAeroStore'
import { useSessionStore } from './useSessionStore'
import { setLookSensitivity as syncLookSensitivity } from '@/input/cameraLookState'
import {
  resetSteering as resetMouseSteering,
  setSteeringConfig as syncMouseSteeringConfig,
  setSteeringLocked as syncMouseSteeringLocked,
} from '@/input/mouseSteeringState'
import { DEFAULT_MOUSE_STEERING_CONFIG, type MouseSteeringConfig } from '@/input/steeringMath'

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
  mouseSteeringEnabled: boolean
  mouseSteeringConfig: MouseSteeringConfig

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
  setMouseSteeringEnabled: (enabled: boolean) => void
  setMouseSteeringConfig: (config: Partial<MouseSteeringConfig>) => void
  resetMouseSteeringConfig: () => void
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
      mouseSteeringEnabled: false,
      mouseSteeringConfig: { ...DEFAULT_MOUSE_STEERING_CONFIG },

      enterMenu: () => {
        resetMouseSteering()
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
        useActiveAeroStore.getState().resetForPreview()
        useCarStore.getState().resetForPreview()
        set(state => ({
          previewReturnStatus:
            state.status === 'preview' ? state.previewReturnStatus : state.status,
          status: 'preview',
        }))
      },
      exitPreviewMode: () => {
        useActiveAeroStore.getState().resetForPreview()
        useCarStore.getState().resetForPreview()
        set(state => ({ status: state.previewReturnStatus }))
      },
      togglePreviewMode: () => {
        useActiveAeroStore.getState().resetForPreview()
        useCarStore.getState().resetForPreview()
        set(state => ({
          ...(state.status !== 'preview' && { previewReturnStatus: state.status }),
          status: state.status === 'preview' ? state.previewReturnStatus : 'preview',
        }))
      },
      toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      setLookSensitivity: sensitivity => {
        syncLookSensitivity(sensitivity)
        set({ lookSensitivity: sensitivity })
      },
      toggleShowFPS: () => set(state => ({ showFPS: !state.showFPS })),
      setMouseSteeringEnabled: enabled => {
        if (enabled) {
          if (typeof document !== 'undefined' && document.pointerLockElement) {
            syncMouseSteeringLocked(true)
          }
        } else {
          resetMouseSteering()
        }
        set({ mouseSteeringEnabled: enabled })
      },
      setMouseSteeringConfig: partial =>
        set(state => {
          const merged = { ...state.mouseSteeringConfig, ...partial }
          syncMouseSteeringConfig(merged)
          return { mouseSteeringConfig: merged }
        }),
      resetMouseSteeringConfig: () => {
        const fresh = { ...DEFAULT_MOUSE_STEERING_CONFIG }
        syncMouseSteeringConfig(fresh)
        set({ mouseSteeringConfig: fresh })
      },
    }),
    {
      name: 'game-settings',
      partialize: state => ({
        cameraMode: state.cameraMode,
        previousCameraMode: state.previousCameraMode,
        lookSensitivity: state.lookSensitivity,
        showFPS: state.showFPS,
        mouseSteeringEnabled: state.mouseSteeringEnabled,
        mouseSteeringConfig: state.mouseSteeringConfig,
      }),
      onRehydrateStorage: () => state => {
        if (!state) return
        syncLookSensitivity(state.lookSensitivity)
        syncMouseSteeringConfig(state.mouseSteeringConfig)
      },
    },
  ),
)
