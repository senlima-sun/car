import type { Tangent2D } from './ribbonMath'

export type XZ = Tangent2D

export interface SegmentIntersection {
  t: number
  u: number
  point: XZ
}

const PARALLEL_EPSILON = 1e-9

export function segmentIntersect2D(
  a0: XZ,
  a1: XZ,
  b0: XZ,
  b1: XZ,
  eps = PARALLEL_EPSILON,
): SegmentIntersection | null {
  const dax = a1.x - a0.x
  const daz = a1.z - a0.z
  const dbx = b1.x - b0.x
  const dbz = b1.z - b0.z

  const cross = dax * dbz - daz * dbx
  if (Math.abs(cross) < eps) return null

  const ox = b0.x - a0.x
  const oz = b0.z - a0.z

  const t = (ox * dbz - oz * dbx) / cross
  const u = (ox * daz - oz * dax) / cross

  if (t < eps || t > 1 - eps || u < eps || u > 1 - eps) return null

  return {
    t,
    u,
    point: {
      x: a0.x + t * dax,
      z: a0.z + t * daz,
    },
  }
}
