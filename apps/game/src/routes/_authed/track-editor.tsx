import { createFileRoute, Outlet } from '@tanstack/react-router'
import App from '@/App'
import { useSyncGameStatus } from '../-useSyncGameStatus'

function TrackEditorLayout() {
  useSyncGameStatus('customize')
  return (
    <>
      <App />
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/_authed/track-editor')({ component: TrackEditorLayout })
