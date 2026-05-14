import type { Point } from './types'

export type Viewport = {
  pan: Point
  zoom: number
  rotation: number
}

export const identityViewport = (): Viewport => ({
  pan: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
})

export const screenToWorld = (v: Viewport, s: Point): Point => {
  const dx = s.x - v.pan.x
  const dy = s.y - v.pan.y
  const cos = Math.cos(-v.rotation)
  const sin = Math.sin(-v.rotation)
  return {
    x: (dx * cos - dy * sin) / v.zoom,
    y: (dx * sin + dy * cos) / v.zoom,
  }
}

export const worldToScreen = (v: Viewport, w: Point): Point => {
  const sx = w.x * v.zoom
  const sy = w.y * v.zoom
  const cos = Math.cos(v.rotation)
  const sin = Math.sin(v.rotation)
  return {
    x: sx * cos - sy * sin + v.pan.x,
    y: sx * sin + sy * cos + v.pan.y,
  }
}

export function zoomAt(v: Viewport, screenPivot: Point, factor: number, clamp = true): Viewport {
  const nextZoom = clamp ? Math.max(0.05, Math.min(40, v.zoom * factor)) : v.zoom * factor
  const world = screenToWorld(v, screenPivot)
  const cos = Math.cos(v.rotation)
  const sin = Math.sin(v.rotation)
  const sx = world.x * nextZoom
  const sy = world.y * nextZoom
  return {
    ...v,
    zoom: nextZoom,
    pan: {
      x: screenPivot.x - (sx * cos - sy * sin),
      y: screenPivot.y - (sx * sin + sy * cos),
    },
  }
}

export function rotateAt(v: Viewport, screenPivot: Point, deltaRotation: number): Viewport {
  const nextRotation = v.rotation + deltaRotation
  const world = screenToWorld(v, screenPivot)
  const cos = Math.cos(nextRotation)
  const sin = Math.sin(nextRotation)
  const sx = world.x * v.zoom
  const sy = world.y * v.zoom
  return {
    ...v,
    rotation: nextRotation,
    pan: {
      x: screenPivot.x - (sx * cos - sy * sin),
      y: screenPivot.y - (sx * sin + sy * cos),
    },
  }
}
