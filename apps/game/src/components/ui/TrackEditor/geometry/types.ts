export type Point = { x: number; y: number }

export type HandleType = 'corner' | 'smooth' | 'mirror'

export type Anchor = {
  id: string
  point: Point
  inHandle: Point
  outHandle: Point
  handleType: HandleType
  /** Elevation in metres, circuit-local frame (subtraction of centerpoint
   *  Mapbox sample). Absent for tracks not yet migrated — those fall back
   *  to DEM-sample-along-ribbon.
   */
  elevation?: number
}

export type AnchorRefSlot = {
  kind: 'ref'
  pathId: string
  anchorIndex: number
}

export type AnchorSlot = Anchor | AnchorRefSlot

export function isAnchorRefSlot(s: AnchorSlot): s is AnchorRefSlot {
  return (s as AnchorRefSlot).kind === 'ref'
}

export type Path = {
  id: string
  anchors: AnchorSlot[]
  closed: boolean
  stroke: string
  strokeWidth: number
  fill: string
  pitLaneSegments?: number[]
  /** Provenance for `anchors[i].elevation`. Absent ⇒ stamp uses
   *  the SRTM sidecar sample-and-smooth fallback.
   */
  elevationSource?: 'mapbox-terrain-rgb' | 'srtm' | 'manual'
}

export type PitBoxArea = {
  id: string
  position: Point
  rotation: number
}

export type EditorDocument = {
  paths: Path[]
}

export type AnchorRef = { pathId: string; anchorIndex: number }

export type HandleRef = {
  pathId: string
  anchorIndex: number
  which: 'in' | 'out'
}

export type CheckpointKind = 'start-finish' | 'sector'

export type CheckpointMarker = {
  id: string
  kind: CheckpointKind
  pathId: string
  segmentIndex: number
  t: number
}

export type RaceDirection = 'forward' | 'backward'

export type CurbVariant = 'apex' | 'exit' | 'flat'

export type CurbEdge = 'left' | 'right'

export type CurbMarker = {
  id: string
  pathId: string
  pathStart: number
  pathEnd: number
  edge: CurbEdge
  variant: CurbVariant
}
