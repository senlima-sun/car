export interface Tangent2D {
  x: number
  z: number
}

export const MAX_MITER_SCALE = 4

export function computeRibbonTangents(
  points: { x: number; z: number }[],
  closed: boolean,
): Tangent2D[] {
  const n = points.length
  const tangents: Tangent2D[] = []
  for (let i = 0; i < n; i++) {
    const prevIdx = i === 0 ? (closed ? n - 1 : 0) : i - 1
    const nextIdx = i === n - 1 ? (closed ? 0 : n - 1) : i + 1
    const prev = points[prevIdx]!
    const next = points[nextIdx]!
    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.hypot(tx, tz) || 1
    tangents.push({ x: tx / len, z: tz / len })
  }
  return tangents
}

export function computeRibbonMiterScales(
  points: { x: number; z: number }[],
  closed: boolean,
  tangents: Tangent2D[],
): number[] {
  const n = points.length
  const scales = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const isStartOpen = !closed && i === 0
    const isEndOpen = !closed && i === n - 1
    if (isStartOpen || isEndOpen) {
      scales[i] = 1
      continue
    }
    const prevIdx = i === 0 ? n - 1 : i - 1
    const prev = points[prevIdx]!
    const curr = points[i]!
    const inDx = curr.x - prev.x
    const inDz = curr.z - prev.z
    const inLen = Math.hypot(inDx, inDz) || 1
    const inTx = inDx / inLen
    const inTz = inDz / inLen
    const bisTan = tangents[i]!
    const dot = bisTan.x * inTx + bisTan.z * inTz
    const safeDot = Math.max(Math.abs(dot), 1 / MAX_MITER_SCALE)
    scales[i] = 1 / safeDot
  }
  return scales
}
