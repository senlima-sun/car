import { useEffect } from 'react'
import { useGameStore } from '@/stores/useGameStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { usePitStore } from '@/stores/usePitStore'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTelemetryStore } from '@/stores/useTelemetryStore'

export function useGlobalKeys() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const game = useGameStore.getState()
      const canToggleTelemetry =
        game.status !== 'menu' && game.status !== 'preview' && game.status !== 'customize'

      if (e.key === 'F2') {
        if (game.status === 'menu') return
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

        if (game.status === 'menu') {
          return
        }

        useGameStore.getState().toggleSettings()
        return
      }

      const { isTestingMode } = useGameStore.getState()
      if (!isTestingMode) return

      if (e.code === 'KeyM' && !useEnvironmentStore.getState().isModalOpen) {
        useEnvironmentStore.getState().toggleModal()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
