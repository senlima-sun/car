import { createFileRoute, Outlet } from '@tanstack/react-router'
import App from '@/App'
import { useSyncGameStatus } from './_internal/useSyncGameStatus'

function TrackEditorLayout() {
  useSyncGameStatus('customize')
  return (
    <>
      <App />
      <Outlet />
    </>
  )
}

export const Route = createFileRoute('/track-editor')({ component: TrackEditorLayout })
