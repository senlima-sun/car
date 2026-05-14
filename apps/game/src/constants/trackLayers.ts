export type TrackLayerName = 'GROUND' | 'ASPHALT' | 'PAINTED_AREA' | 'CURB' | 'EDGE_LINE'

export const TRACK_LAYER_Y_OFFSETS: Record<TrackLayerName, number> = {
  GROUND: 0,
  ASPHALT: 0.05,
  PAINTED_AREA: 0.05,
  CURB: 0.05,
  EDGE_LINE: 0.052,
}

export const TRACK_LAYER_ORDER: Record<TrackLayerName, number> = {
  GROUND: 0,
  ASPHALT: 1,
  PAINTED_AREA: 2,
  CURB: 3,
  EDGE_LINE: 4,
}

export interface PolygonOffsetPair {
  factor: number
  units: number
}

export const TRACK_LAYER_POLYGON_OFFSETS: Record<TrackLayerName, PolygonOffsetPair> = {
  GROUND: { factor: 0, units: 0 },
  ASPHALT: { factor: -1, units: -1 },
  PAINTED_AREA: { factor: -2, units: -2 },
  CURB: { factor: -2, units: -2 },
  EDGE_LINE: { factor: -4, units: -4 },
}
