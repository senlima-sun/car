import { createFileRoute } from '@tanstack/react-router'
import App from '@/App'
import { useSyncGameStatus } from './-useSyncGameStatus'

function RaceRoute() {
  useSyncGameStatus('session')
  return <App />
}

export const Route = createFileRoute('/race/$trackId')({ component: RaceRoute })
