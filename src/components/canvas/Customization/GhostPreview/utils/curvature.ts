export function computeCurvatureRadius(
  start: [number, number, number],
  control: [number, number, number],
  end: [number, number, number],
): { radius: number; center: [number, number, number] } {
  const p0x = start[0],
    p0z = start[2]
  const p1x = control[0],
    p1z = control[2]
  const p2x = end[0],
    p2z = end[2]

  const t = 0.5
  const dtx = 2 * (1 - t) * (p1x - p0x) + 2 * t * (p2x - p1x)
  const dtz = 2 * (1 - t) * (p1z - p0z) + 2 * t * (p2z - p1z)
  const ddtx = 2 * (p2x - 2 * p1x + p0x)
  const ddtz = 2 * (p2z - 2 * p1z + p0z)

  const speedSq = dtx * dtx + dtz * dtz
  const speed = Math.sqrt(speedSq)
  const cross = Math.abs(dtx * ddtz - dtz * ddtx)

  if (cross < 0.001) return { radius: Infinity, center: [0, 0, 0] }

  const radius = (speed * speedSq) / cross

  const mx = (1 - t) * (1 - t) * p0x + 2 * (1 - t) * t * p1x + t * t * p2x
  const mz = (1 - t) * (1 - t) * p0z + 2 * (1 - t) * t * p1z + t * t * p2z

  const nx = -dtz / speed
  const nz = dtx / speed

  const signedCross = dtx * ddtz - dtz * ddtx
  const sign = signedCross > 0 ? 1 : -1

  const cx = mx + sign * radius * nx
  const cz = mz + sign * radius * nz

  return { radius, center: [cx, 0, cz] }
}
