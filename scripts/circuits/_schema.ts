export interface CircuitConfigFile {
  name: string
  displayName: string
  provenance: 'osm' | 'manual'

  overpass?: {
    bbox: [south: number, west: number, north: number, east: number]
    queryFilters: string[]
    relationId?: number
  }

  centerLat?: number
  centerLon?: number
  startWayName?: string
  wayNameDenyList?: string[]
  wayNameAllowPattern?: string
  maxChainGap?: number
  // TODO(elevation-zones-deprecation): superseded by per-circuit terrain sidecars
  // (apps/game/src/constants/tracks/sources/_terrain/*.heightmap.json). Retained
  // for the legacy generateRoadSegments output path; remove with that function.
  elevationZones?: {
    startFraction: number
    endFraction: number
    elevation: number
  }[]
  reverseDirection?: boolean

  sectorSplits?: [number, number]
  startFinishFraction: number

  expectedTrackLengthMeters: number
  expectedTurns: number
  expectedStartHeadingDegrees: number

  terrainBBox?: {
    halfExtentMeters: number
  }
  terrainGeoref?:
    | {
        mode: 'georef'
        centerLat: number
        centerLon: number
        headingDeg: number
        scaleMetersPerUnit: number
        halfExtentMeters: number
      }
    | { mode: 'flat' }
}
