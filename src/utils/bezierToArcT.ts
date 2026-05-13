import {
  pointOnPathAt,
  segmentCount,
} from '@/components/ui/TrackEditor/geometry/closestPoint'
import type { Path } from '@/components/ui/TrackEditor/geometry/types'

export const BEZIER_TO_ARC_SAMPLE_SPACING = 1

export function bezierTToArcT(path: Path, bezierT: number, allPaths: Path[]): number {
  const segCount = segmentCount(path)
  if (segCount <= 0) return 0
  const clamped = Math.max(0, Math.min(segCount, bezierT))

  const probe = segCount * 64
  let prev: { x: number; y: number } | null = null
  let total = 0
  let target = 0
  let targetSet = false
  for (let i = 0; i <= probe; i++) {
    const t = (segCount * i) / probe
    const sample = pointOnPathAt(path, t, allPaths)
    if (!sample) continue
    if (prev) {
      total += Math.hypot(sample.point.x - prev.x, sample.point.y - prev.y)
    }
    if (!targetSet && t >= clamped) {
      target = total
      targetSet = true
    }
    prev = { x: sample.point.x, y: sample.point.y }
  }
  if (!targetSet) target = total
  if (total <= 0) return 0
  return target / total
}
