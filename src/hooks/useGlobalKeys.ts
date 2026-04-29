import { useEffect } from 'react'
import {
  isCustomizeStatus,
  isMenuStatus,
  isSessionShellStatus,
  useGameStore,
} from '@/stores/useGameStore'
import {
  isPausedSessionPhase,
  isRunningSessionPhase,
  useSessionStore,
} from '@/stores/useSessionStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { usePitStore } from '@/stores/usePitStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTelemetryStore } from '@/stores/useTelemetryStore'

export function useGlobalKeys() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const game = useGameStore.getState()
      const session = useSessionStore.getState()
      const canToggleTelemetry =
        isSessionShellStatus(game.status) && isRunningSessionPhase(session.phase)

      if (e.key === 'F2') {
        if (isMenuStatus(game.status)) return
        e.preventDefault()
        game.togglePreviewMode()
        return
      }

      if (e.key === 'F3') {
        if (!canToggleTelemetry) return
        e.preventDefault()
        useTelemetryStore.getState().toggleOverlay()
        return
      }

      if (e.key === 'F4') {
        if (!canToggleTelemetry) return
        e.preventDefault()
        useTelemetryStore.getState().toggleAnalysis()
        return
      }

      if (e.key === 'Escape') {
        const env = useEnvironmentStore.getState()
        if (env.isModalOpen) {
          env.closeModal()
          return
        }

        const pit = usePitStore.getState()
        if (pit.isPitStopActive) {
          pit.cancelPitStop()
          return
        }

        const editor = useEditorStore.getState()
        if (editor.placementState !== 'idle' && editor.placementState !== 'selecting') {
          editor.cancelPlacement()
          return
        }

        if (game.isSettingsOpen) {
          game.closeSettings()
          return
        }

        if (isSessionShellStatus(game.status) && isRunningSessionPhase(session.phase)) {
          session.pauseSession()
          return
        }

        if (isSessionShellStatus(game.status) && isPausedSessionPhase(session.phase)) {
          session.resumeSession()
          return
        }

        if (isMenuStatus(game.status) || isCustomizeStatus(game.status)) {
          return
        }

        useGameStore.getState().toggleSettings()
        return
      }

      const isTestingMode = useSessionStore.getState().config?.testingMode ?? false
      if (!isTestingMode) return

      if (e.code === 'KeyM' && !useEnvironmentStore.getState().isModalOpen) {
        useEnvironmentStore.getState().toggleModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
