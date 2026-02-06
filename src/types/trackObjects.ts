export type ObjectType = 'cone' | 'ramp' | 'checkpoint' | 'barrier' | 'road' | 'curb'
export type TrackMode = 'straight' | 'curve'
export type CheckpointType = 'start-finish' | 'sector'

export interface PlacedObject {
  id: string
  type: ObjectType
  position: [number, number, number]
  rotation: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  controlPoint?: [number, number, number]
  trackMode?: TrackMode
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
  parentRoadId?: string
  edgeSide?: 'left' | 'right'
  startT?: number
  endT?: number
  flowDirection?: 'forward' | 'backward' | null
  checkpointType?: CheckpointType
  checkpointOrder?: number
  width?: number
  startElevation?: number
  endElevation?: number
  banking?: number
}

export type PlacementState =
  | 'idle'
  | 'selecting'
  | 'placing'
  | 'dragging'
  | 'placingControlPoint'
  | 'curbDragging'

export interface CurbDragState {
  roadId: string
  road: PlacedObject
  edge: 'left' | 'right'
  startT: number
  startPosition: [number, number, number]
}

export interface PartialDeleteState {
  roadId: string
  road: PlacedObject
  startT: number
  startPosition: [number, number, number]
}

export interface SnapPointWithDirection {
  position: [number, number, number]
  direction: [number, number, number]
  leftEdge: [number, number, number]
  rightEdge: [number, number, number]
  tangent: [number, number, number]
}

export interface RoadEdgeResult {
  roadId: string
  leftEdge: [number, number, number]
  rightEdge: [number, number, number]
  centerPoint: [number, number, number]
}

export interface RoadEdgeHitResult {
  roadId: string
  road: PlacedObject
  edge: 'left' | 'right'
  t: number
  worldPosition: [number, number, number]
}

export interface RoadSurfaceHitResult {
  roadId: string
  road: PlacedObject
  t: number
  centerPosition: [number, number, number]
}

export interface ElevationControlPoint {
  roadId: string
  road: PlacedObject
  endpoint: 'start' | 'end'
  worldPosition: [number, number, number]
  elevation: number
}

export interface ElevationDragState {
  roadId: string
  endpoint: 'start' | 'end'
  initialHeight: number
  currentHeight: number
  screenStartY: number
  connectedEndpoints: ElevationControlPoint[]
}

export type ElevationTool = 'raise' | 'level' | 'slope' | 'smooth'

export interface SlopeAnchor {
  roadId: string
  endpoint: 'start' | 'end'
  height: number
}

export const isLinearObject = (type: ObjectType): boolean => {
  return type === 'barrier' || type === 'road'
}
