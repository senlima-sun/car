import { worldToGps } from '../osm-ingest/chaining'
import type { MapboxTerrainRgbProvider } from './providers/mapbox-terrain-rgb'

export interface SamplerCircuitConfig {
  centerLat: number
  centerLon: number
}

export interface AnchorLike {
  point: { x: number; y: number }
  elevation?: number
}

export interface PathLike {
  anchors: AnchorLike[]
  elevationSource?: string
}

export interface SamplerResult {
  anchorCount: number
  freshFetches: number
  centerpointElevation: number
}

/**
 * Walk every anchor in every path of a track JSON, query Mapbox at the
 * matching lat/lon, and write the elevation into anchor.elevation.
 *
 * Datum handling (per O6 in satellite-truth-ingest plan):
 *   1. Sample Mapbox once at (config.centerLat, config.centerLon) — this is
 *      the anchor of the circuit's local frame.
 *   2. For every anchor i, the recorded elevation is
 *        anchor.elevation = mapbox(anchor lat, anchor lon) - mapbox(centerpoint)
 *   3. This produces a ribbon-local frame that doesn't depend on Mapbox's
 *      (region-dependent) datum. The sidecar's verticalOriginMeters is
 *      NOT used.
 *
 * Mutates `paths` in place. Returns counters for the caller to print.
 */
export async function sampleAnchorElevations(args: {
  paths: PathLike[]
  config: SamplerCircuitConfig
  provider: Pick<MapboxTerrainRgbProvider, 'sample'>
}): Promise<SamplerResult> {
  const { paths, config, provider } = args
  const centerpointElevation = await provider.sample(
    config.centerLat,
    config.centerLon,
  )
  let anchorCount = 0
  for (const path of paths) {
    for (const anchor of path.anchors) {
      const { lat, lon } = worldToGps(
        anchor.point.x,
        anchor.point.y,
        config.centerLat,
        config.centerLon,
      )
      const absolute = await provider.sample(lat, lon)
      anchor.elevation = absolute - centerpointElevation
      anchorCount++
    }
    path.elevationSource = 'mapbox-terrain-rgb'
  }
  return {
    anchorCount,
    freshFetches: -1, // The provider tracks its own cache; caller can read it.
    centerpointElevation,
  }
}
