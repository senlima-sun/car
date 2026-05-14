import { createFileRoute } from '@tanstack/react-router'
import App from '@/App'
import { useSyncGameStatus } from './_internal/useSyncGameStatus'

function MenuRoute() {
  useSyncGameStatus('menu')
  return <App />
}

export const Route = createFileRoute('/')({ component: MenuRoute })
