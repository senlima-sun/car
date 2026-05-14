import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { useTrackStore } from '@/stores/useTrackStore'
import type { SavedTrack } from '@/types/track'
import type { PlacedObject } from '@/types/trackObjects'
import {
  buildTrackObjectsFromEditorSource,
  type EditorTrackDocument,
} from '@/utils/editorTrackSource'

const DRAFT_TRACK_ID = 'editor_draft'
const DRAFT_TRACK_NAME = 'Editor Draft'

export type ExportInput = EditorTrackDocument

export type ExportPreview = {
  ribbonCount: number
  checkpointCount: number
  pitBoxCount: number
  commit: () => void
}

export const buildExportPayload = buildTrackObjectsFromEditorSource

function writeDraftTrack(objects: PlacedObject[]): void {
  const now = Date.now()
  const trackState = useTrackStore.getState()
  const library = trackState.trackLibrary
  const existingIndex = library.tracks.findIndex(t => t.id === DRAFT_TRACK_ID)

  const terrainState = useTerrainStore.getState()
  const hasTerrainData = terrainState.heightmap.some(h => h !== 0)
  const heightmap = hasTerrainData ? terrainState.getHeightsArray() : undefined

  const nextDraft: SavedTrack = {
    id: DRAFT_TRACK_ID,
    name: DRAFT_TRACK_NAME,
    createdAt: existingIndex >= 0 ? (library.tracks[existingIndex]!.createdAt ?? now) : now,
    updatedAt: now,
    objectCount: objects.length,
    objects,
    heightmap,
  }

  const nextTracks =
    existingIndex >= 0
      ? library.tracks.map((t, i) => (i === existingIndex ? nextDraft : t))
      : [...library.tracks, nextDraft]

  useTrackStore.setState({
    trackLibrary: {
      ...library,
      tracks: nextTracks,
      activeTrackId: DRAFT_TRACK_ID,
    },
    isDirty: false,
  })

  useCustomizationStore.getState().setPlacedObjects(objects)
  void useTrackStore
    .getState()
    .saveLibrary()
    .catch(error => console.error('Failed to save library after editor export:', error))
}

export function exportToTrackStore(input: ExportInput): ExportPreview {
  const objects = buildExportPayload(input)
  const ribbonCount = objects.filter(o => o.type === 'track_ribbon').length
  const checkpointCount = objects.filter(o => o.type === 'checkpoint').length
  const pitBoxCount = objects.filter(o => o.type === 'pitbox').length

  return {
    ribbonCount,
    checkpointCount,
    pitBoxCount,
    commit: () => writeDraftTrack(objects),
  }
}
