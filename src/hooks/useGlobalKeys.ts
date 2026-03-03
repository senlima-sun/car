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

      if (e.key === 'F1') {
        e.preventDefault()
        useGameStore.getState().toggleCustomizeMode()
        return
      }

      if (e.key === 'F2') {
        e.preventDefault()
        useGameStore.getState().togglePreviewMode()
        return
      }

      if (e.key === 'F3') {
        e.preventDefault()
        useTelemetryStore.getState().toggleOverlay()
        return
      }

      if (e.key === 'F4') {
        e.preventDefault()
        useTelemetryStore.getState().toggleAnalysis()
        return
      }

      if (e.shiftKey && e.code === 'Backslash') {
        e.preventDefault()
        useGameStore.getState().toggleTestingMode()
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

        const game = useGameStore.getState()
        if (game.isSettingsOpen) {
          game.closeSettings()
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
