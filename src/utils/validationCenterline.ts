import type { PlacedObject, TrackRibbonPoint } from '@/types/trackObjects'
import type { ValidationCenterlineSample } from '@/stores/useValidationDriveStore'

const SAMPLE_SPACING_M = 5

function ribbonLength(points: TrackRibbonPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    total += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return total
}

function resampleRibbon(
  points: TrackRibbonPoint[],
  spacing: number,
): ValidationCenterlineSample[] {
  if (points.length < 2) return []

  const cumulativeByIndex: number[] = [0]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    cumulativeByIndex.push(
      cumulativeByIndex[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z),
    )
  }
  const totalLength = cumulativeByIndex[cumulativeByIndex.length - 1]!
  if (totalLength <= 0) return []

  const samples: ValidationCenterlineSample[] = []
  let segIndex = 0
  for (let d = 0; d <= totalLength; d += spacing) {
    while (
      segIndex + 1 < cumulativeByIndex.length &&
      cumulativeByIndex[segIndex + 1]! < d
    ) {
      segIndex++
    }
    if (segIndex + 1 >= cumulativeByIndex.length) break
    const a = points[segIndex]!
    const b = points[segIndex + 1]!
    const segStart = cumulativeByIndex[segIndex]!
    const segEnd = cumulativeByIndex[segIndex + 1]!
    const segLen = segEnd - segStart
    const t = segLen > 1e-9 ? (d - segStart) / segLen : 0
    samples.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      cumulativeDistance: d,
    })
  }
  return samples
}

export function buildValidationCenterline(
  objects: PlacedObject[],
): ValidationCenterlineSample[] {
  const ribbons = objects.filter(
    o => o.type === 'track_ribbon' && o.ribbonPoints && o.ribbonPoints.length >= 2,
  )
  if (ribbons.length === 0) return []

  let bestRibbon: PlacedObject | null = null
  let bestLength = 0
  for (const ribbon of ribbons) {
    const len = ribbonLength(ribbon.ribbonPoints!)
    if (len > bestLength) {
      bestLength = len
      bestRibbon = ribbon
    }
  }

  if (!bestRibbon || !bestRibbon.ribbonPoints) return []
  return resampleRibbon(bestRibbon.ribbonPoints, SAMPLE_SPACING_M)
}
