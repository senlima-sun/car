import type { PlacedObject } from '../stores/useCustomizationStore'

export interface TrackMetadata {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  objectCount: number
}

/**
 * v1 fields kept readable so legacy IndexedDB payloads type-check until the
 * v1→v2 migration runs. All three (HeightmapSource, heightmap, heightmapSource)
 * are removed in Phase 6.1.
 */
export type HeightmapSource = 'none' | 'sidecar' | 'user'

export interface SavedTrack extends TrackMetadata {
  schemaVersion?: 2
  objects: PlacedObject[]
  pitLaneData?: unknown
  presetId?: string
  baseline?: number[]
  delta?: number[]
  sidecarApplied?: boolean
  customBaselineUsed?: boolean
  deltaPresent?: boolean
  heightmapSidecarRef?: string
  heightmap?: number[]
  heightmapSource?: HeightmapSource
}

export interface TrackLibrary {
  version: number
  activeTrackId: string | null
  tracks: SavedTrack[]
}

export const CURRENT_SAVED_TRACK_SCHEMA_VERSION = 2

export function isV1SavedTrack(track: SavedTrack): boolean {
  return track.schemaVersion === undefined
}

export function migrateSavedTrackV1ToV2(track: SavedTrack): SavedTrack {
  if (track.schemaVersion !== undefined) return track

  const oldSource = track.heightmapSource
  const oldHeightmap = track.heightmap

  let baseline: number[] | undefined
  let delta: number[] | undefined
  let sidecarApplied = false
  let customBaselineUsed = false
  let deltaPresent = false
  let heightmapSidecarRef: string | undefined

  if (track.presetId) {
    heightmapSidecarRef = track.presetId
  }

  if (oldSource === 'sidecar') {
    sidecarApplied = true
  } else if (oldSource === 'user' && oldHeightmap && oldHeightmap.length > 0) {
    delta = oldHeightmap
    deltaPresent = oldHeightmap.some(h => h !== 0)
  } else if (oldHeightmap && oldHeightmap.length > 0) {
    if (track.presetId) {
      delta = oldHeightmap
      deltaPresent = oldHeightmap.some(h => h !== 0)
    } else {
      baseline = oldHeightmap
      customBaselineUsed = oldHeightmap.some(h => h !== 0)
    }
  }

  const cleanObjects = track.objects.map(stripRibbonY)

  const migrated: SavedTrack = {
    id: track.id,
    name: track.name,
    createdAt: track.createdAt,
    updatedAt: track.updatedAt,
    objectCount: cleanObjects.length,
    schemaVersion: 2,
    objects: cleanObjects,
    pitLaneData: track.pitLaneData,
    presetId: track.presetId,
    sidecarApplied,
    customBaselineUsed,
    deltaPresent,
  }
  if (baseline) migrated.baseline = baseline
  if (delta) migrated.delta = delta
  if (heightmapSidecarRef) migrated.heightmapSidecarRef = heightmapSidecarRef

  return migrated
}

const zeroY = (pts: NonNullable<PlacedObject['ribbonPoints']>) =>
  pts.map(p => ({ x: p.x, y: 0, z: p.z, isPitLane: p.isPitLane }))

function stripRibbonY(object: PlacedObject): PlacedObject {
  if (!object.ribbonPoints && !object.curbCenterline) return object
  const cleaned: PlacedObject = { ...object }
  if (object.ribbonPoints) cleaned.ribbonPoints = zeroY(object.ribbonPoints)
  if (object.curbCenterline) cleaned.curbCenterline = zeroY(object.curbCenterline)
  return cleaned
}
