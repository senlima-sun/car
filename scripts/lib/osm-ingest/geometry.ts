import type { Point2D } from './chaining'

export function perpendicularDistance(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
): number {
  const dx = lineEnd.x - lineStart.x
  const dz = lineEnd.z - lineStart.z
  const lineLenSq = dx * dx + dz * dz
  if (lineLenSq === 0) {
    const ddx = point.x - lineStart.x
    const ddz = point.z - lineStart.z
    return Math.sqrt(ddx * ddx + ddz * ddz)
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / lineLenSq),
  )
  const projX = lineStart.x + t * dx
  const projZ = lineStart.z + t * dz
  const ddx = point.x - projX
  const ddz = point.z - projZ
  return Math.sqrt(ddx * ddx + ddz * ddz)
}

export function douglasPeucker(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0
  const end = points.length - 1

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end])
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[end]]
}

export function computeCurvature(p0: Point2D, p1: Point2D, p2: Point2D): number {
  const area = Math.abs((p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z)) / 2
  const d01 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2)
  const d12 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.z - p1.z) ** 2)
  const d02 = Math.sqrt((p2.x - p0.x) ** 2 + (p2.z - p0.z) ** 2)
  const denom = d01 * d12 * d02
  if (denom < 0.001) return 0
  return (4 * area) / denom
}

export function fitQuadraticBezier(points: Point2D[]): { control: Point2D; error: number } {
  const start = points[0]
  const end = points[points.length - 1]

  const t0x = points[1].x - points[0].x
  const t0z = points[1].z - points[0].z

  const t1x = points[points.length - 1].x - points[points.length - 2].x
  const t1z = points[points.length - 1].z - points[points.length - 2].z

  const det = t0x * t1z - t0z * t1x
  if (Math.abs(det) < 0.001) {
    const mid = points[Math.floor(points.length / 2)]
    return { control: { x: mid.x, z: mid.z }, error: 0 }
  }

  const dx = end.x - start.x
  const dz = end.z - start.z
  const t = (dx * t1z - dz * t1x) / det

  const control: Point2D = {
    x: start.x + t * t0x,
    z: start.z + t * t0z,
  }

  let maxError = 0
  for (let i = 1; i < points.length - 1; i++) {
    const u = i / (points.length - 1)
    const u1 = 1 - u
    const bx = u1 * u1 * start.x + 2 * u1 * u * control.x + u * u * end.x
    const bz = u1 * u1 * start.z + 2 * u1 * u * control.z + u * u * end.z
    const err = Math.sqrt((points[i].x - bx) ** 2 + (points[i].z - bz) ** 2)
    maxError = Math.max(maxError, err)
  }

  return { control, error: maxError }
}
