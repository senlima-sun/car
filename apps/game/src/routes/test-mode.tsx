import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import App from '@/App'
import { ExportDemoButton } from '@/components/ui/HUD/ExportDemoButton'
import { LoadAiGhostButton } from '@/components/ui/HUD/LoadAiGhostButton'
import { useSessionStore } from '@/stores/useSessionStore'
import { useSyncGameStatus } from './-useSyncGameStatus'

function TestModeRoute() {
  useSyncGameStatus('session')
  useEffect(() => {
    useSessionStore.getState().startQuickSession('practice', { testingMode: true })
  }, [])
  return (
    <>
      <App />
      <LoadAiGhostButton />
      <ExportDemoButton />
    </>
  )
}

export const Route = createFileRoute('/test-mode')({ component: TestModeRoute })
