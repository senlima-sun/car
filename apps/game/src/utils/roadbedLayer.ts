import { TRACK_WIDTH } from '../constants/dimensions'
import { useTerrainStore } from '../stores/useTerrainStore'
import {
  DEFAULT_STAMP_CONFIG,
  computeRoadbedLayer,
  ribbonStampInputsFromObjects,
} from './terrainStamp'

interface RoadbedSourceObject {
  id?: string
  type: string
  ribbonPoints?: Parameters<typeof ribbonStampInputsFromObjects>[0][number]['ribbonPoints']
  ribbonClosed?: boolean
  width?: number
}

/**
 * Regenerate the derived roadbed layer in useTerrainStore from the
 * current raw baseline + delta and the supplied track ribbons.
 *
 * Call sites:
 *   - preset load (after applyStampedSidecar baked the stamp into the
 *     baseline — roadbed comes out near-zero, keeping the store
 *     idempotent for sidecar-sourced tracks).
 *   - editor export (no sidecar, so roadbed carries the entire cut/fill).
 *   - terrain edits that affect the active track (re-derive after the
 *     user sculpts so the road footprint still sits at the stamped
 *     target height).
 *
 * The function is a no-op for empty object lists and clears the layer
 * deterministically so successive calls never accumulate.
 */
export function refreshRoadbedLayer(
  objects: ReadonlyArray<RoadbedSourceObject>,
): void {
  const terrain = useTerrainStore.getState()
  const ribbons = ribbonStampInputsFromObjects(objects, TRACK_WIDTH)
  if (ribbons.length === 0) {
    if (terrain.roadbedPresent) terrain.resetRoadbed()
    return
  }
  const composed = terrain.getComposedHeightsSnapshot()
  for (let i = 0; i < composed.length; i++) {
    composed[i] -= terrain.roadbed[i]!
  }
  const layer = computeRoadbedLayer(
    composed,
    terrain.resolution,
    terrain.worldSize,
    ribbons,
    DEFAULT_STAMP_CONFIG,
  )
  terrain.replaceRoadbed(layer)
}
