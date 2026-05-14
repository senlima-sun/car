import type { Point } from './types'

export const pt = (x: number, y: number): Point => ({ x, y })
export const clonePt = (p: Point): Point => ({ x: p.x, y: p.y })

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k })
export const neg = (a: Point): Point => ({ x: -a.x, y: -a.y })

export const len = (a: Point): number => Math.hypot(a.x, a.y)
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

export const eq = (a: Point, b: Point, eps = 1e-6): boolean =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps

export const normalize = (a: Point): Point => {
  const l = len(a)
  if (l < 1e-9) return { x: 0, y: 0 }
  return { x: a.x / l, y: a.y / l }
}

export const reflect = (pivot: Point, p: Point): Point => ({
  x: 2 * pivot.x - p.x,
  y: 2 * pivot.y - p.y,
})

export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})
