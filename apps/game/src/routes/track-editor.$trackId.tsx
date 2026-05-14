import { createFileRoute } from '@tanstack/react-router'

function TrackEditorTrack() {
  return null
}

export const Route = createFileRoute('/track-editor/$trackId')({ component: TrackEditorTrack })
