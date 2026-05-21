import {
  buildRibbonBoundary,
  type RibbonBoundary,
  type TerrainSampler,
} from '../components/canvas/TrackObjects/geometry/ribbonBoundary'
import { TRACK_LAYER_Y_OFFSETS } from '../constants/trackLayers'
import type { PlacedObject, TrackRibbonPoint } from '../types/trackObjects'

export interface RoadCorridor {
  id: string
  centerline: TrackRibbonPoint[]
  width: number
  halfWidth: number
  closed: boolean
  hasPitLane: boolean
  hasAuthoredElevation: boolean
}

interface RibbonLikeObject {
  id?: string
  type: string
  ribbonPoints?: TrackRibbonPoint[]
  ribbonClosed?: boolean
  width?: number
}

const TRACK_RIBBON_TYPE = 'track_ribbon'

export function buildRoadCorridorsFromObjects(
  objects: ReadonlyArray<RibbonLikeObject>,
  defaultWidth: number,
): RoadCorridor[] {
  const out: RoadCorridor[] = []
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i]!
    const corridor = corridorFromRibbon(o, defaultWidth, i)
    if (corridor) out.push(corridor)
  }
  return out
}

export function corridorFromRibbon(
  obj: RibbonLikeObject,
  defaultWidth: number,
  fallbackIndex = 0,
): RoadCorridor | null {
  if (obj.type !== TRACK_RIBBON_TYPE) return null
  const points = obj.ribbonPoints
  if (!points || points.length < 2) return null
  const width = obj.width && obj.width > 0 ? obj.width : defaultWidth
  if (width <= 0) return null
  const hasPitLane = points.some(p => p.isPitLane === true)
  const hasAuthoredElevation = points.every(p => p.elevation !== undefined)
  return {
    id: obj.id ?? `ribbon-${fallbackIndex}`,
    centerline: points,
    width,
    halfWidth: width / 2,
    closed: obj.ribbonClosed ?? false,
    hasPitLane,
    hasAuthoredElevation,
  }
}

export type RoadCorridorSource = Pick<PlacedObject, 'id' | 'type' | 'ribbonPoints' | 'ribbonClosed' | 'width'>

export function corridorBoundary(
  corridor: RoadCorridor,
  options: { yOffset?: number; terrainSampler?: TerrainSampler } = {},
): RibbonBoundary | null {
  return buildRibbonBoundary(
    corridor.centerline,
    corridor.closed,
    corridor.width,
    options.yOffset ?? TRACK_LAYER_Y_OFFSETS.ASPHALT,
    options.terrainSampler,
  )
}

