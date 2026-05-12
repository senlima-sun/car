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
    if (i === 0 || i === n - 2) {
      isStraight.push(true)
      continue
    }
    const curvature = computeCurvature(
      simplifiedPoints[i - 1],
      simplifiedPoints[i],
      simplifiedPoints[i + 1],
    )
    isStraight.push(curvature < CURVATURE_THRESHOLD)
  }

  interface StraightRun {
    endFraction: number
    chordLength: number
  }

  const straightRuns: StraightRun[] = []
  let runStart = -1
  let distanceCovered = 0

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
    distanceCovered += segmentLengths[i]
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
    console.warn('  ⚠️  Could not detect two distinct sector splits, falling back to [0.33, 0.66]')
    return [0.33, 0.66]
  }

  const [s1, s2] = sector1 < sector2 ? [sector1, sector2] : [sector2, sector1]

  const inBand1 = s1 >= 0.20 && s1 <= 0.45
  const inBand2 = s2 >= 0.55 && s2 <= 0.85
  if (!inBand1 || !inBand2) {
    console.warn(
      `  ⚠️  Detected splits [${s1.toFixed(3)}, ${s2.toFixed(3)}] outside expected bands ([0.20-0.45], [0.55-0.85]) — proceeding`,
    )
  }

  return [
    Math.round(s1 * 1000) / 1000,
    Math.round(s2 * 1000) / 1000,
  ]
}
