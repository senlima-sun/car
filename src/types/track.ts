import type { PlacedObject } from '../stores/useCustomizationStore'
import type { PitLaneData } from '../stores/usePitStore'

export interface TrackMetadata {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  objectCount: number
}

export interface SavedTrack extends TrackMetadata {
  objects: PlacedObject[]
  pitLaneData: PitLaneData | null
}

export interface TrackLibrary {
  version: number
  activeTrackId: string | null
  tracks: SavedTrack[]
}
