import type { WeatherSource } from '@/wasm'

export interface Point2D {
  x: number
  z: number
}

export function arcLength(points: Point2D[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dz = points[i].z - points[i - 1].z
    total += Math.sqrt(dx * dx + dz * dz)
  }
  return total
}

export function resampleByArcLength(points: Point2D[], n: number): Point2D[] {
  if (points.length === 0 || n <= 0) return []
  if (points.length === 1) return Array.from({ length: n }, () => ({ ...points[0] }))

  const segLengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dz = points[i].z - points[i - 1].z
    const len = Math.sqrt(dx * dx + dz * dz)
    segLengths.push(len)
    total += len
  }
  if (total <= 0) return Array.from({ length: n }, () => ({ ...points[0] }))

  const step = total / Math.max(1, n - 1)
  const out: Point2D[] = [points[0]]
  let target = step
  let acc = 0
  let segIdx = 0

  while (out.length < n - 1 && segIdx < segLengths.length) {
    const segLen = segLengths[segIdx]
    if (acc + segLen >= target) {
      const local = (target - acc) / Math.max(0.0001, segLen)
      const a = points[segIdx]
      const b = points[segIdx + 1]
      out.push({
        x: a.x + (b.x - a.x) * local,
        z: a.z + (b.z - a.z) * local,
      })
      target += step
    } else {
      acc += segLen
      segIdx++
    }
  }
  while (out.length < n) out.push({ ...points[points.length - 1] })
  return out
}

export interface PathToSourceOptions {
  sourceCount: number
  radius: number
  intensity: number
  velocityMagnitude: number
}

export function pathToSources(
  points: Point2D[],
  options: PathToSourceOptions,
): WeatherSource[] {
  const samples = resampleByArcLength(points, options.sourceCount)
  if (samples.length === 0) return []

  const sources: WeatherSource[] = []
  for (let i = 0; i < samples.length; i++) {
    const here = samples[i]
    const prev = samples[Math.max(0, i - 1)]
    const next = samples[Math.min(samples.length - 1, i + 1)]
    const tx = next.x - prev.x
    const tz = next.z - prev.z
    const len = Math.sqrt(tx * tx + tz * tz)

    let vx = 0
    let vz = 0
    if (len > 0.0001) {
      const px = -tz / len
      const pz = tx / len
      vx = px * options.velocityMagnitude
      vz = pz * options.velocityMagnitude
    }

    sources.push({
      x: here.x,
      z: here.z,
      radius: options.radius,
      intensity: options.intensity,
      vx,
      vz,
    })
  }
  return sources
}
