import { TRACK_WIDTH } from '../constants/dimensions'
import { useTerrainStore } from '../stores/useTerrainStore'
import type { TrackRibbonPoint } from '../types/trackObjects'
import { getTerrainHeightmapForPreset } from './terrainSidecar'
import {
  DEFAULT_STAMP_CONFIG,
  ribbonStampInputsFromObjects,
  stampRibbonsIntoBaseline,
} from './terrainStamp'

/**
 * Single side-effect orchestration helper for the five sidecar consumers
 * (useTrackStore × 3, TerrainControls toolbar, suspension tolerance test).
 *
 * Flow per call:
 *   1. Fetch the raw sidecar for `presetId`.
 *   2. Build the stamp-input list from `objects` (track_ribbon items only).
 *   3. Run the pure stamp pass over a copy of the raw heightmap.
 *   4. Install the stamped baseline via useTerrainStore.replaceBaseline.
 *   5. If `deltaPolicy === 'reset'`, also call resetDelta().
 *
 * Returns `{ applied, rawHeightmap }`:
 *   - applied=false, rawHeightmap=null when fetch fails or no sidecar exists.
 *   - applied=true, rawHeightmap=number[] on success. The raw bytes are
 *     surfaced so callers can persist them for offline re-stamps without
 *     having to re-fetch (e.g. SavedTrack.heightmap).
 *
 * deltaPolicy: 'preserve' (re-stamp keeps user sculpt) or 'reset' (drop
 * delta — used by destructive flows: initial preset load, "Import Real
 * Elevation" button, deterministic test fixtures).
 */
export interface ApplyStampedSidecarOptions {
  deltaPolicy: 'preserve' | 'reset'
}

export interface ApplyStampedSidecarResult {
  applied: boolean
  rawHeightmap: number[] | null
}

interface RibbonStampObject {
  type: string
  ribbonPoints?: TrackRibbonPoint[]
  ribbonClosed?: boolean
  width?: number
}

export async function applyStampedSidecar(
  presetId: string,
  objects: ReadonlyArray<RibbonStampObject>,
  opts: ApplyStampedSidecarOptions,
): Promise<ApplyStampedSidecarResult> {
  const sidecar = await getTerrainHeightmapForPreset(presetId).catch(() => null)
  if (!sidecar) return { applied: false, rawHeightmap: null }

  const terrain = useTerrainStore.getState()
  const raw = Float32Array.from(sidecar.heightmap)
  const ribbons = ribbonStampInputsFromObjects(objects, TRACK_WIDTH)
  const stamped = stampRibbonsIntoBaseline(
    raw,
    terrain.resolution,
    terrain.worldSize,
    ribbons,
    DEFAULT_STAMP_CONFIG,
  )

  terrain.replaceBaseline(stamped, { source: 'sidecar' })
  if (opts.deltaPolicy === 'reset') terrain.resetDelta()
  // Sidecar bakes the stamp into baseline; clear the derived roadbed
  // layer so reloads remain idempotent regardless of prior state.
  terrain.resetRoadbed()
  return { applied: true, rawHeightmap: sidecar.heightmap }
}
