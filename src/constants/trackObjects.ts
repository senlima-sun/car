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
  curb: {
    type: 'curb',
    label: 'Curb',
    description: 'F1-style kerb stripe',
    isLinear: false,
    defaultSize: { width: 1.5, height: 0.1, depth: 1 },
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
}

export const OBJECT_TYPES: ObjectType[] = ['cone', 'ramp', 'checkpoint', 'barrier', 'road', 'curb', 'pitbox']

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
