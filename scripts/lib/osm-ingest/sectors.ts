import type { Point2D } from './chaining'
import { computeCurvature } from './geometry'

const CURVATURE_THRESHOLD = 0.005
const MIN_ADJACENCY_GAP = 0.10

export function autoDetectSectorSplits(simplifiedPoints: Point2D[]): [number, number] {
  const n = simplifiedPoints.length
  if (n < 4) return [0.33, 0.66]

  const segmentLengths: number[] = []
  let totalLength = 0
  for (let i = 1; i < n; i++) {
    const dx = simplifiedPoints[i].x - simplifiedPoints[i - 1].x
    const dz = simplifiedPoints[i].z - simplifiedPoints[i - 1].z
    const len = Math.sqrt(dx * dx + dz * dz)
    segmentLengths.push(len)
    totalLength += len
  }

  const isStraight: boolean[] = []
  for (let i = 0; i < n - 1; i++) {
    if (i === 0) {
      isStraight.push(true)
      continue
    }
    const curvature = computeCurvature(
      simplifiedPoints[i - 1],
      simplifiedPoints[i],
      simplifiedPoints[i + 1] ?? simplifiedPoints[i],
    )
    isStraight.push(curvature < CURVATURE_THRESHOLD)
  }

  interface StraightRun {
    endFraction: number
    chordLength: number
  }

  const straightRuns: StraightRun[] = []
  let runStart = -1

  for (let i = 0; i < isStraight.length; i++) {
    if (isStraight[i] && runStart === -1) {
      runStart = i
    }
    if ((!isStraight[i] || i === isStraight.length - 1) && runStart !== -1) {
      const runEnd = isStraight[i] ? i : i - 1
      let runLength = 0
      let startDist = 0
      for (let j = 0; j < runStart; j++) startDist += segmentLengths[j]
      for (let j = runStart; j <= runEnd; j++) runLength += segmentLengths[j]

      const endDist = startDist + runLength
      const endFraction = endDist / totalLength

      const startPt = simplifiedPoints[runStart]
      const endPt = simplifiedPoints[runEnd + 1] ?? simplifiedPoints[runEnd]
      const chordLength = Math.sqrt(
        (endPt.x - startPt.x) ** 2 + (endPt.z - startPt.z) ** 2,
      )

      straightRuns.push({ endFraction, chordLength })
      runStart = -1
    }
  }

  straightRuns.sort((a, b) => b.chordLength - a.chordLength)

  let sector1: number | null = null
  let sector2: number | null = null

  for (const run of straightRuns) {
    if (sector1 === null) {
      sector1 = run.endFraction
      continue
    }
    if (Math.abs(run.endFraction - sector1) < MIN_ADJACENCY_GAP) {
      continue
    }
    sector2 = run.endFraction
    break
  }

  if (sector1 === null || sector2 === null) {
    throw new Error(
      'autoDetectSectorSplits: could not detect two distinct sector splits; circuit needs explicit sectorSplits in its config',
    )
  }

  const [s1, s2] = sector1 < sector2 ? [sector1, sector2] : [sector2, sector1]

  if (s1 >= 0.98) {
    throw new Error(
      `autoDetectSectorSplits: detected sector boundary at lap-end (endFraction=${s1.toFixed(3)}); circuit needs explicit sectorSplits in its config`,
    )
  }
  if (s2 >= 0.98) {
    throw new Error(
      `autoDetectSectorSplits: detected sector boundary at lap-end (endFraction=${s2.toFixed(3)}); circuit needs explicit sectorSplits in its config`,
    )
  }

  if (s1 < 0.20 || s1 > 0.45) {
    throw new Error(
      `autoDetectSectorSplits: sector 1 split ${s1.toFixed(3)} is outside expected band [0.20, 0.45]; circuit needs explicit sectorSplits in its config`,
    )
  }
  if (s2 < 0.55 || s2 > 0.85) {
    throw new Error(
      `autoDetectSectorSplits: sector 2 split ${s2.toFixed(3)} is outside expected band [0.55, 0.85]; circuit needs explicit sectorSplits in its config`,
    )
  }

  return [
    Math.round(s1 * 1000) / 1000,
    Math.round(s2 * 1000) / 1000,
  ]
}
