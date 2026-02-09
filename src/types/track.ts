import type { PlacedObject } from '../stores/useCustomizationStore'

export interface TrackMetadata {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  objectCount: number
}

export interface SavedTrack extends TrackMetadata {
  objects: PlacedObject[]
  pitLaneData?: unknown
}

export interface TrackLibrary {
  version: number
  activeTrackId: string | null
  tracks: SavedTrack[]
}
