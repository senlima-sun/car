import type { AnchorRef, HandleRef, Point } from '../geometry/types'

export type PenDrag = {
  kind: 'pen-handle'
  pathId: string
  anchorIndex: number
  startScreen: Point
}

export type HandleDrag = {
  kind: 'handle'
  ref: HandleRef
  startScreen: Point
  moved: boolean
}

export type AnchorDrag = {
  kind: 'anchor'
  ref: AnchorRef
  startWorld: Point
  anchorOrigin: Point
  startScreen: Point
  moved: boolean
}

export type PanDrag = {
  kind: 'pan'
  startScreen: Point
  startPan: Point
}

export type PitAreaDrag = {
  kind: 'pit-area-move'
  id: string
  startWorld: Point
  origin: Point
  startScreen: Point
  moved: boolean
}

export type PitAreaRotateDrag = {
  kind: 'pit-area-rotate'
  id: string
  originRotation: number
  originPosition: Point
}

export type CurbDrag = {
  kind: 'curb'
  pathId: string
  edge: 'left' | 'right'
  pathStart: number
  pathEnd: number
}

export type CheckpointDrag = {
  kind: 'checkpoint'
  id: string
  origin: { pathId: string; segmentIndex: number; t: number }
  startScreen: Point
  moved: boolean
}

export type Drag =
  | PenDrag
  | HandleDrag
  | AnchorDrag
  | PanDrag
  | PitAreaDrag
  | PitAreaRotateDrag
  | CurbDrag
  | CheckpointDrag
  | null
