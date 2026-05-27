import { createFileRoute } from '@tanstack/react-router'
import App from '@/App'
import { useSyncGameStatus } from '../-useSyncGameStatus'

function ShowroomRoute() {
  useSyncGameStatus('preview')
  return <App />
}

export const Route = createFileRoute('/_authed/showroom')({ component: ShowroomRoute })
