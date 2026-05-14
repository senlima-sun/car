import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import App from '@/App'
import { useSessionStore } from '@/stores/useSessionStore'
import { useSyncGameStatus } from './-useSyncGameStatus'

function TestModeRoute() {
  useSyncGameStatus('session')
  useEffect(() => {
    useSessionStore.getState().startQuickSession('practice', { testingMode: true })
  }, [])
  return <App />
}

export const Route = createFileRoute('/test-mode')({ component: TestModeRoute })
