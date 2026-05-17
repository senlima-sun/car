export interface Vec2 {
  x: number
  z: number
}

export interface SegmentIntersection {
  t: number
  u: number
  point: Vec2
}

export function segmentIntersect2D(
  a0: Vec2,
  a1: Vec2,
  b0: Vec2,
  b1: Vec2,
  eps = 1e-9,
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
