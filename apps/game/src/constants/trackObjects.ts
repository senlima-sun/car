import type { ObjectType } from '../types/trackObjects'
import { TRACK_OBJECT } from './colors'

export interface ObjectConfig {
  type: ObjectType
  label: string
  description: string
  isLinear: boolean
  defaultSize: {
    width: number
    height: number
    depth: number
  }
  color: string
  friction: number
  restitution: number
}

export const OBJECT_CONFIGS: Record<ObjectType, ObjectConfig> = {
  cone: {
    type: 'cone',
    label: 'Cone',
    description: 'Traffic cone marker',
    isLinear: false,
    defaultSize: { width: 0.5, height: 0.8, depth: 0.5 },
    color: TRACK_OBJECT.cone,
    friction: 0.5,
    restitution: 0.3,
  },
  ramp: {
    type: 'ramp',
    label: 'Ramp',
    description: 'Jump ramp',
    isLinear: false,
    defaultSize: { width: 5, height: 1.5, depth: 8 },
    color: TRACK_OBJECT.barrier,
    friction: 0.8,
    restitution: 0.1,
  },
  checkpoint: {
    type: 'checkpoint',
    label: 'Checkpoint',
    description: 'Race checkpoint gate',
    isLinear: false,
    defaultSize: { width: 12, height: 4, depth: 0.5 },
    color: TRACK_OBJECT.checkpoint,
    friction: 0,
    restitution: 0,
  },
  corner: {
    type: 'corner',
    label: 'Corner',
    description: 'Numbered turn marker (T1, T2, …)',
    isLinear: false,
    defaultSize: { width: 0.6, height: 2.2, depth: 0.6 },
    color: '#ffcc33',
    friction: 0,
    restitution: 0,
  },
  barrier: {
    type: 'barrier',
    label: 'Barrier',
    description: 'Concrete barrier wall',
    isLinear: true,
    defaultSize: { width: 0.6, height: 1.1, depth: 1 },
    color: TRACK_OBJECT.barrierAlt,
    friction: 0.6,
    restitution: 0.2,
  },
  road: {
    type: 'road',
    label: 'Road',
    description: 'Asphalt road segment',
    isLinear: true,
    defaultSize: { width: 12, height: 0.15, depth: 1 },
    color: TRACK_OBJECT.road,
    friction: 1.0,
    restitution: 0,
  },
  track_ribbon: {
    type: 'track_ribbon',
    label: 'Track Ribbon',
    description: 'Continuous track ribbon',
    isLinear: false,
    defaultSize: { width: 12, height: 0.15, depth: 1 },
    color: TRACK_OBJECT.road,
    friction: 1.0,
    restitution: 0,
  },
  curb: {
    type: 'curb',
    label: 'Curb',
    description: 'F1-style kerb stripe',
    isLinear: false,
    defaultSize: { width: 0.8, height: 0.05, depth: 1 },
    color: TRACK_OBJECT.curb,
    friction: 0.7,
    restitution: 0.1,
  },
  pitbox: {
    type: 'pitbox',
    label: 'Pit Box',
    description: 'Pit stop service area',
    isLinear: false,
    defaultSize: { width: 15, height: 0.1, depth: 8 },
    color: TRACK_OBJECT.pitAsphaltDark,
    friction: 1.0,
    restitution: 0,
  },
  grass_patch: {
    type: 'grass_patch',
    label: 'Grass',
    description: 'Grass runoff area',
    isLinear: false,
    defaultSize: { width: 10, height: 0.02, depth: 10 },
    color: '#4a8c3f',
    friction: 0.4,
    restitution: 0,
  },
  gravel_patch: {
    type: 'gravel_patch',
    label: 'Gravel',
    description: 'Gravel trap runoff area',
    isLinear: false,
    defaultSize: { width: 10, height: 0.025, depth: 10 },
    color: '#8a7f6d',
    friction: 0.65,
    restitution: 0,
  },
  painted_area: {
    type: 'painted_area',
    label: 'Painted',
    description: 'Painted run-off strip beside the curb (auto-generated per path)',
    isLinear: false,
    defaultSize: { width: 3, height: 0.02, depth: 10 },
    color: '#a8d89c',
    friction: 0.85,
    restitution: 0,
  },
  wall: {
    type: 'wall',
    label: 'Wall',
    description: 'Low concrete wall',
    isLinear: true,
    defaultSize: { width: 0.5, height: 0.8, depth: 1 },
    color: '#8a8a8a',
    friction: 0.6,
    restitution: 0.2,
  },
  wall_fence: {
    type: 'wall_fence',
    label: 'Wall+Fence',
    description: 'Wall with metal fence on top',
    isLinear: true,
    defaultSize: { width: 0.5, height: 2.0, depth: 1 },
    color: '#8a8a6a',
    friction: 0.6,
    restitution: 0.2,
  },
  edge_line: {
    type: 'edge_line',
    label: 'Track Limit',
    description: 'White track-limit line anchored to the embedded roadbed corridor boundary',
    isLinear: false,
    defaultSize: { width: 0.2, height: 0.02, depth: 1 },
    color: '#ffffff',
    friction: 1.0,
    restitution: 0,
  },
}

export const OBJECT_TYPES: ObjectType[] = [
  'cone',
  'ramp',
  'checkpoint',
  'corner',
  'barrier',
  'wall',
  'wall_fence',
  'road',
  'curb',
  'pitbox',
  'grass_patch',
  'gravel_patch',
]

// Pit road constants
export const PIT_ROAD_WIDTH = 8
export const PIT_ROAD_SPEED_LIMIT_KMH = 80
export const PIT_ROAD_SPEED_LIMIT_MS = PIT_ROAD_SPEED_LIMIT_KMH / 3.6
export const PIT_ROAD_COLOR = TRACK_OBJECT.pitAsphalt
export const PIT_ROAD_EDGE_COLOR = TRACK_OBJECT.pitLane

// Pit box constants
export const PIT_BOX_LENGTH = 15
export const PIT_BOX_WIDTH = 8

// Ghost preview settings
export const GHOST_OPACITY = 0.5
export const GHOST_COLOR_VALID = TRACK_OBJECT.ghostValid
export const GHOST_COLOR_INVALID = TRACK_OBJECT.ghostInvalid

// Placement settings
export const MIN_SEGMENT_LENGTH = 2 // Minimum length for linear objects
export const SNAP_ANGLE = Math.PI / 8 // 22.5 degrees for rotation snapping

export const SECTOR_COLORS = ['#00ff88', '#00ccff', '#ffaa00', '#ff4488'] as const

export function getSectorColor(order: number | undefined): string {
  const idx = Math.max(0, (order ?? 1) - 1) % SECTOR_COLORS.length
  return SECTOR_COLORS[idx]
}
