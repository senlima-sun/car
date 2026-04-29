import type { Point } from './types'

export type Viewport = {
  pan: Point
  zoom: number
}

export const identityViewport = (): Viewport => ({
  pan: { x: 0, y: 0 },
  zoom: 1,
})

export const screenToWorld = (v: Viewport, s: Point): Point => ({
  x: (s.x - v.pan.x) / v.zoom,
  y: (s.y - v.pan.y) / v.zoom,
})

export const worldToScreen = (v: Viewport, w: Point): Point => ({
  x: w.x * v.zoom + v.pan.x,
  y: w.y * v.zoom + v.pan.y,
})

export function zoomAt(v: Viewport, screenPivot: Point, factor: number, clamp = true): Viewport {
  const nextZoom = clamp ? Math.max(0.05, Math.min(40, v.zoom * factor)) : v.zoom * factor
  const world = screenToWorld(v, screenPivot)
  return {
    zoom: nextZoom,
    pan: {
      x: screenPivot.x - world.x * nextZoom,
      y: screenPivot.y - world.y * nextZoom,
    },
  }
}
