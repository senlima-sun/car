import type { ObjectType, TrackMode } from '@/types/trackObjects'
import { isPitRoad } from '@/types/trackObjects'

export interface SVGStyle {
  stroke: string
  strokeWidth: number
  fill: string
  opacity: number
  strokeDasharray?: string
  strokeLinecap?: 'round' | 'butt' | 'square'
}

const ROAD_STYLE: SVGStyle = {
  stroke: '#ffffff',
  strokeWidth: 12,
  fill: 'none',
  opacity: 1,
  strokeLinecap: 'round',
}

const PIT_ROAD_STYLE: SVGStyle = {
  stroke: '#ff8800',
  strokeWidth: 8,
  fill: 'none',
  opacity: 1,
  strokeLinecap: 'round',
}

const CURB_STYLE: SVGStyle = {
  stroke: '#ff0000',
  strokeWidth: 1.5,
  fill: 'none',
  opacity: 1,
  strokeLinecap: 'round',
}

const BARRIER_STYLE: SVGStyle = {
  stroke: '#888888',
  strokeWidth: 0.6,
  fill: 'none',
  opacity: 1,
  strokeLinecap: 'round',
}

const WALL_STYLE: SVGStyle = {
  stroke: '#666666',
  strokeWidth: 0.5,
  fill: 'none',
  opacity: 1,
  strokeLinecap: 'round',
}

const WALL_FENCE_STYLE: SVGStyle = {
  stroke: '#777777',
  strokeWidth: 0.5,
  fill: 'none',
  opacity: 1,
  strokeLinecap: 'round',
}

const CHECKPOINT_STYLE: SVGStyle = {
  stroke: '#00ff00',
  strokeWidth: 0.3,
  fill: 'none',
  opacity: 1,
  strokeDasharray: '2 1',
}

const CORNER_STYLE: SVGStyle = {
  stroke: '#ffcc33',
  strokeWidth: 0.25,
  fill: '#ffcc33',
  opacity: 1,
}

const CONE_STYLE: SVGStyle = {
  stroke: '#ff6b00',
  strokeWidth: 0.15,
  fill: '#ff6b00',
  opacity: 1,
}

const PITBOX_STYLE: SVGStyle = {
  stroke: '#ff8800',
  strokeWidth: 0.3,
  fill: '#ff8800',
  opacity: 0.2,
  strokeDasharray: '1 0.5',
}

const RAMP_STYLE: SVGStyle = {
  stroke: '#ffcc00',
  strokeWidth: 0.3,
  fill: '#ffcc00',
  opacity: 0.3,
}

const GRASS_PATCH_STYLE: SVGStyle = {
  stroke: '#4a8c3f',
  strokeWidth: 0.15,
  fill: '#4a8c3f',
  opacity: 0.25,
}

const GRAVEL_PATCH_STYLE: SVGStyle = {
  stroke: '#8a7f6d',
  strokeWidth: 0.15,
  fill: '#8a7f6d',
  opacity: 0.25,
}

export function getObjectStyle(type: ObjectType, trackMode?: TrackMode): SVGStyle {
  switch (type) {
    case 'road':
      return isPitRoad(trackMode) ? PIT_ROAD_STYLE : ROAD_STYLE
    case 'curb':
      return CURB_STYLE
    case 'barrier':
      return BARRIER_STYLE
    case 'wall':
      return WALL_STYLE
    case 'wall_fence':
      return WALL_FENCE_STYLE
    case 'checkpoint':
      return CHECKPOINT_STYLE
    case 'corner':
      return CORNER_STYLE
    case 'cone':
      return CONE_STYLE
    case 'pitbox':
      return PITBOX_STYLE
    case 'ramp':
      return RAMP_STYLE
    case 'grass_patch':
      return GRASS_PATCH_STYLE
    case 'gravel_patch':
      return GRAVEL_PATCH_STYLE
  }
}

export const SELECTION_COLOR = '#00bfff'
export const SNAP_POINT_COLOR = '#00ffff'
export const GHOST_VALID_COLOR = '#00ff88'
export const GHOST_INVALID_COLOR = '#ff4444'
export const GRID_COLOR_MINOR = 'rgba(255,255,255,0.06)'
export const GRID_COLOR_MAJOR = 'rgba(255,255,255,0.12)'
export const GRID_COLOR_ORIGIN = 'rgba(255,255,255,0.25)'
export const BACKGROUND_COLOR = '#1a1a2e'
