import type { ObjectType } from '../stores/useCustomizationStore'

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
    color: '#ff6b00',
    friction: 0.5,
    restitution: 0.3,
  },
  ramp: {
    type: 'ramp',
    label: 'Ramp',
    description: 'Jump ramp',
    isLinear: false,
    defaultSize: { width: 4, height: 1.5, depth: 6 },
    color: '#666666',
    friction: 0.8,
    restitution: 0.1,
  },
  checkpoint: {
    type: 'checkpoint',
    label: 'Checkpoint',
    description: 'Race checkpoint gate',
    isLinear: false,
    defaultSize: { width: 8, height: 4, depth: 0.5 },
    color: '#00ff00',
    friction: 0,
    restitution: 0,
  },
  barrier: {
    type: 'barrier',
    label: 'Barrier',
    description: 'Concrete barrier wall',
    isLinear: true,
    defaultSize: { width: 0.6, height: 1, depth: 1 }, // depth is per-unit length
    color: '#888888',
    friction: 0.6,
    restitution: 0.2,
  },
  road: {
    type: 'road',
    label: 'Road',
    description: 'Asphalt road segment',
    isLinear: true,
    defaultSize: { width: 16, height: 0.05, depth: 1 }, // depth is per-unit length
    color: '#333333',
    friction: 1.0,
    restitution: 0,
  },
  curb: {
    type: 'curb',
    label: 'Curb',
    description: 'F1-style kerb stripe',
    isLinear: false,
    defaultSize: { width: 2, height: 0.1, depth: 1 },
    color: '#ff0000',
    friction: 0.7,
    restitution: 0.1,
  },
}

export const OBJECT_TYPES: ObjectType[] = ['cone', 'ramp', 'checkpoint', 'barrier', 'road', 'curb']

// Pit lane specific constants
export const PIT_LANE_WIDTH = 8
export const PIT_LANE_ENTRY_ANGLE = Math.PI / 6 // 30 degrees

// Ghost preview settings
export const GHOST_OPACITY = 0.5
export const GHOST_COLOR_VALID = '#00ff00'
export const GHOST_COLOR_INVALID = '#ff0000'

// Placement settings
export const MIN_SEGMENT_LENGTH = 2 // Minimum length for linear objects
export const SNAP_ANGLE = Math.PI / 8 // 22.5 degrees for rotation snapping
