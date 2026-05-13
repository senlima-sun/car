export type ObjectType =
  | 'cone'
  | 'ramp'
  | 'checkpoint'
  | 'corner'
  | 'barrier'
  | 'road'
  | 'track_ribbon'
  | 'curb'
  | 'pitbox'
  | 'grass_patch'
  | 'gravel_patch'
  | 'painted_area'
  | 'wall'
  | 'wall_fence'
export type TrackMode = 'straight' | 'curve' | 'pitroad' | 'pitroad-curve'
export type CheckpointType = 'start-finish' | 'sector'
export type CurbType = 'apex' | 'exit' | 'flat'
export type LayerGroup = 'surface' | 'edge' | 'painted' | 'curb' | 'pit'

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
  polygonPoints?: Array<[number, number, number]>
  curbType?: CurbType
  curbCenterline?: TrackRibbonPoint[]
  rippleHeight?: number
  adImageUrl?: string
  cornerNumber?: number
  ribbonPoints?: TrackRibbonPoint[]
  ribbonClosed?: boolean
  layerGroup?: LayerGroup
}

export interface TrackRibbonPoint {
  x: number
  y: number
  z: number
  isPitLane: boolean
}

export type PlacementState =
  | 'idle'
  | 'selecting'
  | 'placing'
  | 'dragging'
  | 'placingControlPoint'
  | 'curbDragging'
  | 'polygonDrawing'

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
  elevation: number
  banking: number
  roadId: string
  endpoint: 'start' | 'end'
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
  return type === 'barrier' || type === 'road' || type === 'wall' || type === 'wall_fence'
}

export const isWallType = (type: ObjectType): boolean => {
  return type === 'wall' || type === 'wall_fence'
}

export const isPolygonObject = (type: ObjectType): boolean => {
  return type === 'grass_patch' || type === 'gravel_patch'
}

export const isPitRoad = (trackMode?: TrackMode): boolean => {
  return trackMode === 'pitroad' || trackMode === 'pitroad-curve'
}

export const isCurveMode = (trackMode?: TrackMode): boolean => {
  return trackMode === 'curve' || trackMode === 'pitroad-curve'
}
