import type { PlacedObject } from '@/types/trackObjects'
import type { TrackPath } from '@/types/trackPath'
import {
  evaluateCubicBezier,
  evaluateCubicBezierDerivative,
  cubicBezierCurvature,
  cubicToQuadraticApprox,
  getSplineSegment,
  getSplineSegmentCount,
  perpendicularAtPoint,
  splitCubicBezier,
} from './trackPathInterpolation'

const MAX_SEGMENT_ARC = 80
const MIN_SEGMENT_ARC = 10
const CURVATURE_STRAIGHT_THRESHOLD = 0.003
const QUADRATIC_ERROR_THRESHOLD = 1.0
const SAMPLES_PER_SEGMENT = 32

interface SamplePoint {
  t: number
  position: [number, number]
  tangent: [number, number]
  curvature: number
  arcLength: number
  elevation: number
  width: number
}

type Edge3 = [number, number, number]

function averageEdge(a: Edge3, b: Edge3): Edge3 {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5]
}

function reconcileSharedEdge(prev: PlacedObject, next: PlacedObject): void {
  if (!prev.endLeftEdge || !prev.endRightEdge || !next.startLeftEdge || !next.startRightEdge) return

  // Force both road slices to share exactly the same seam edge points to avoid visible white-line gaps.
  const mergedLeft = averageEdge(prev.endLeftEdge, next.startLeftEdge)
  const mergedRight = averageEdge(prev.endRightEdge, next.startRightEdge)

  prev.endLeftEdge = mergedLeft
  prev.endRightEdge = mergedRight
  next.startLeftEdge = mergedLeft
  next.startRightEdge = mergedRight
}

function sampleSplineSegment(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  startElev: number,
  endElev: number,
  startWidth: number,
  endWidth: number,
  samples: number = SAMPLES_PER_SEGMENT,
): SamplePoint[] {
  const points: SamplePoint[] = []
  let accLen = 0
  let prevX = P0[0]
  let prevY = P0[1]

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pos = evaluateCubicBezier(P0, P1, P2, P3, t)
    const tan = evaluateCubicBezierDerivative(P0, P1, P2, P3, t)
    const curv = cubicBezierCurvature(P0, P1, P2, P3, t)

    if (i > 0) {
      accLen += Math.sqrt((pos[0] - prevX) ** 2 + (pos[1] - prevY) ** 2)
    }

    const elev = startElev + (endElev - startElev) * t
    const width = startWidth + (endWidth - startWidth) * t

    points.push({
      t,
      position: pos,
      tangent: tan,
      curvature: curv,
      arcLength: accLen,
      elevation: elev,
      width: width,
    })

    prevX = pos[0]
    prevY = pos[1]
  }

  return points
}

function isStraightEnough(samples: SamplePoint[], fromIdx: number, toIdx: number): boolean {
  for (let i = fromIdx; i <= toIdx; i++) {
    if (samples[i].curvature > CURVATURE_STRAIGHT_THRESHOLD) return false
  }
  return true
}

function quadraticApproxError(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
): number {
  const approx = cubicToQuadraticApprox(P0, P1, P2, P3)
  let maxError = 0

  for (let i = 1; i < 10; i++) {
    const t = i / 10
    const cubicPt = evaluateCubicBezier(P0, P1, P2, P3, t)

    const t1 = 1 - t
    const qx = t1 * t1 * approx.start[0] + 2 * t1 * t * approx.control[0] + t * t * approx.end[0]
    const qy = t1 * t1 * approx.start[1] + 2 * t1 * t * approx.control[1] + t * t * approx.end[1]

    const err = Math.sqrt((cubicPt[0] - qx) ** 2 + (cubicPt[1] - qy) ** 2)
    if (err > maxError) maxError = err
  }

  return maxError
}

interface SegmentSlice {
  startT: number
  endT: number
  isStraight: boolean
  P0: [number, number]
  P1: [number, number]
  P2: [number, number]
  P3: [number, number]
}

function sliceCubicSegment(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  samples: SamplePoint[],
): SegmentSlice[] {
  const totalArc = samples[samples.length - 1].arcLength
  if (totalArc < MIN_SEGMENT_ARC) {
    return [
      {
        startT: 0,
        endT: 1,
        isStraight: isStraightEnough(samples, 0, samples.length - 1),
        P0,
        P1,
        P2,
        P3,
      },
    ]
  }

  const slices: SegmentSlice[] = []
  let startIdx = 0

  while (startIdx < samples.length - 1) {
    let endIdx = samples.length - 1

    const remaining = samples[samples.length - 1].arcLength - samples[startIdx].arcLength
    if (remaining <= MAX_SEGMENT_ARC) {
      endIdx = samples.length - 1
    } else {
      for (let j = startIdx + 1; j < samples.length; j++) {
        const arc = samples[j].arcLength - samples[startIdx].arcLength
        if (arc >= MAX_SEGMENT_ARC) {
          endIdx = j
          break
        }
      }
    }

    const arcLen = samples[endIdx].arcLength - samples[startIdx].arcLength
    if (arcLen < MIN_SEGMENT_ARC && slices.length > 0) {
      const prev = slices[slices.length - 1]
      prev.endT = samples[endIdx].t
      const sub = extractCubicSubcurve(P0, P1, P2, P3, prev.startT, prev.endT)
      prev.P0 = sub.P0
      prev.P1 = sub.P1
      prev.P2 = sub.P2
      prev.P3 = sub.P3
      break
    }

    const tStart = samples[startIdx].t
    const tEnd = samples[endIdx].t
    const sub = extractCubicSubcurve(P0, P1, P2, P3, tStart, tEnd)

    slices.push({
      startT: tStart,
      endT: tEnd,
      isStraight: isStraightEnough(samples, startIdx, endIdx),
      ...sub,
    })

    startIdx = endIdx
  }

  return slices
}

function extractCubicSubcurve(
  P0: [number, number],
  P1: [number, number],
  P2: [number, number],
  P3: [number, number],
  t0: number,
  t1: number,
): { P0: [number, number]; P1: [number, number]; P2: [number, number]; P3: [number, number] } {
  if (t0 === 0 && t1 === 1) return { P0, P1, P2, P3 }

  if (t0 === 0) {
    return splitCubicBezier(P0, P1, P2, P3, t1).left
  }

  if (t1 === 1) {
    return splitCubicBezier(P0, P1, P2, P3, t0).right
  }

  const first = splitCubicBezier(P0, P1, P2, P3, t1)
  const remapped = t0 / t1
  const second = splitCubicBezier(
    first.left.P0,
    first.left.P1,
    first.left.P2,
    first.left.P3,
    remapped,
  )
  return second.right
}

function convertSliceToQuadratic(slice: SegmentSlice): {
  start: [number, number]
  end: [number, number]
  control?: [number, number]
} {
  if (slice.isStraight) {
    return { start: slice.P0, end: slice.P3 }
  }

  const error = quadraticApproxError(slice.P0, slice.P1, slice.P2, slice.P3)
  if (error < QUADRATIC_ERROR_THRESHOLD) {
    const approx = cubicToQuadraticApprox(slice.P0, slice.P1, slice.P2, slice.P3)
    return { start: approx.start, end: approx.end, control: approx.control }
  }

  const approx = cubicToQuadraticApprox(slice.P0, slice.P1, slice.P2, slice.P3)
  return { start: approx.start, end: approx.end, control: approx.control }
}

function computeEdges(
  pos: [number, number],
  tangent: [number, number],
  halfWidth: number,
  elevation: number,
): { left: [number, number, number]; right: [number, number, number] } {
  const perp = perpendicularAtPoint(tangent)
  return {
    left: [pos[0] + perp.leftX * halfWidth, elevation, pos[1] + perp.leftY * halfWidth],
    right: [pos[0] + perp.rightX * halfWidth, elevation, pos[1] + perp.rightY * halfWidth],
  }
}

export function segmentizePath(path: TrackPath): PlacedObject[] {
  const segCount = getSplineSegmentCount(path)
  if (segCount === 0) return []

  const results: PlacedObject[] = []
  let globalIdx = 0

  for (let si = 0; si < segCount; si++) {
    const seg = getSplineSegment(path, si)
    const samples = sampleSplineSegment(
      seg.P0,
      seg.P1,
      seg.P2,
      seg.P3,
      seg.startElev,
      seg.endElev,
      seg.startWidth,
      seg.endWidth,
    )

    const slices = sliceCubicSegment(seg.P0, seg.P1, seg.P2, seg.P3, samples)

    for (const slice of slices) {
      const quad = convertSliceToQuadratic(slice)
      const startT = slice.startT
      const endT = slice.endT

      const startElev = seg.startElev + (seg.endElev - seg.startElev) * startT
      const endElev = seg.startElev + (seg.endElev - seg.startElev) * endT
      const startW = seg.startWidth + (seg.endWidth - seg.startWidth) * startT
      const endW = seg.startWidth + (seg.endWidth - seg.startWidth) * endT
      const startTan = evaluateCubicBezierDerivative(seg.P0, seg.P1, seg.P2, seg.P3, startT)
      const endTan = evaluateCubicBezierDerivative(seg.P0, seg.P1, seg.P2, seg.P3, endT)

      const startEdges = computeEdges(quad.start, startTan, startW / 2, startElev)
      const endEdges = computeEdges(quad.end, endTan, endW / 2, endElev)

      const startPoint: [number, number, number] = [quad.start[0], 0, quad.start[1]]
      const endPoint: [number, number, number] = [quad.end[0], 0, quad.end[1]]

      const road: PlacedObject = {
        id: `tp_${path.id}_${globalIdx}`,
        type: 'road',
        position: [(startPoint[0] + endPoint[0]) / 2, 0, (startPoint[2] + endPoint[2]) / 2],
        rotation: Math.atan2(endPoint[0] - startPoint[0], endPoint[2] - startPoint[2]),
        startPoint,
        endPoint,
        trackMode: quad.control ? 'curve' : 'straight',
        startLeftEdge: startEdges.left,
        startRightEdge: startEdges.right,
        endLeftEdge: endEdges.left,
        endRightEdge: endEdges.right,
        startElevation: startElev,
        endElevation: endElev,
      }

      if (quad.control) {
        road.controlPoint = [quad.control[0], 0, quad.control[1]]
      }

      if (path.type === 'pit') {
        road.trackMode = quad.control ? 'pitroad-curve' : 'pitroad'
        road.width = path.width
      }

      results.push(road)
      globalIdx++
    }
  }

  for (let i = 1; i < results.length; i++) {
    reconcileSharedEdge(results[i - 1], results[i])
  }

  if (path.closed && results.length > 1) {
    reconcileSharedEdge(results[results.length - 1], results[0])
  }

  return results
}
