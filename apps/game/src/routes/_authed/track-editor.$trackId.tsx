import { createFileRoute } from '@tanstack/react-router'

function TrackEditorTrack() {
  return null
}

export const Route = createFileRoute('/_authed/track-editor/$trackId')({ component: TrackEditorTrack })
