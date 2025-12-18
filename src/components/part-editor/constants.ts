import type { GeometryType } from './types'

export const GEOMETRY_DEFAULTS: Record<GeometryType, { args: number[]; name: string; icon: string; points?: [number, number][]; heightProfile?: [number, number][]; heightProfileSmooth?: boolean }> = {
  box: { args: [1, 1, 1], name: 'Box', icon: '◻' },
  cylinder: { args: [0.5, 0.5, 1, 32], name: 'Cylinder', icon: '○' },
  sphere: { args: [0.5, 32, 16], name: 'Sphere', icon: '●' },
  torus: { args: [0.5, 0.2, 16, 32], name: 'Torus', icon: '◎' },
  cone: { args: [0.5, 1, 32], name: 'Cone', icon: '△' },
  capsule: { args: [0.25, 0.5, 8, 16], name: 'Capsule', icon: '⬭' },
  roundedbox: { args: [1, 1, 1, 4, 0.1], name: 'Rounded', icon: '▢' },  // [w, h, d, segments, radius]
  extrude: {
    args: [0.5, 0.05, 3],  // [depth, bevelRadius, bevelSegments]
    name: 'Extrude',
    icon: '⬠',
    points: [[0, 0], [1, 0], [1, 0.6], [0.5, 1], [0, 0.6]],  // Default house shape
    heightProfile: [[0, 1], [1, 1]],  // Default flat/uniform profile
    heightProfileSmooth: true,
  },
}

export const DEFAULT_MATERIAL = {
  color: '#666666',
  metalness: 0.5,
  roughness: 0.5,
}

export const SNAP_VALUES = [0.1, 0.25, 0.5, 1.0] as const

export const ROTATION_SNAP_VALUES = [
  Math.PI / 12,  // 15 degrees
  Math.PI / 6,   // 30 degrees
  Math.PI / 4,   // 45 degrees
  Math.PI / 2,   // 90 degrees
] as const

export const PART_EDITOR_STORAGE_KEY = 'car-part-editor-wip'

export const MAX_HISTORY_LENGTH = 50

export const EDITOR_COLORS = {
  grid: '#444444',
  gridCenter: '#666666',
  selection: '#00ff00',
  hover: '#ffff00',
  background: '#1a1a2e',
}
