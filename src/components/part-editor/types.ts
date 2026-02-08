export type GeometryType =
  | 'box'
  | 'cylinder'
  | 'sphere'
  | 'torus'
  | 'cone'
  | 'capsule'
  | 'roundedbox'
  | 'extrude'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export interface EditorPart {
  id: string
  name: string
  geometryType: GeometryType
  args: number[]
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string
  metalness: number
  roughness: number
  // For extrude geometry: 2D outline points
  mass?: number
  density?: number
  points?: [number, number][]
  holes?: [number, number][][]
  // For extrude geometry: height profile [[position (0-1), height (0-1)], ...]
  heightProfile?: [number, number][]
  // For extrude geometry: smooth interpolation vs stepped
  heightProfileSmooth?: boolean
}

export interface CarPartConfig {
  version: number
  name: string
  createdAt: number
  updatedAt: number
  parts: EditorPart[]
}

export interface HistoryEntry {
  parts: EditorPart[]
  selectedId: string | null
}
