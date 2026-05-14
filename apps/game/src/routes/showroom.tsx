import { createFileRoute } from '@tanstack/react-router'
import App from '@/App'
import { useSyncGameStatus } from './_internal/useSyncGameStatus'

function ShowroomRoute() {
  useSyncGameStatus('preview')
  return <App />
}

export const Route = createFileRoute('/showroom')({ component: ShowroomRoute })
