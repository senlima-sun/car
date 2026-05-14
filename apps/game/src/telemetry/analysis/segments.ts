import type { LapTrace } from '../schema'

export type LossReason =
  | 'braking_too_early'
  | 'braking_too_late'
  | 'lift_too_long'
  | 'slow_apex'
  | 'traction_loss'
  | 'ers_misuse'

export interface SegmentLoss {
  segmentIndex: number
  startS: number
  endS: number
  deltaMs: number
  reason: LossReason
  detail?: string
}

const DEFAULT_SEGMENT_COUNT = 20

function integrateDistance(frames: LapTrace['frames']): number[] {
  const result = new Array<number>(frames.length)
  if (frames.length === 0) return result
  result[0] = 0
  let acc = 0
  for (let i = 1; i < frames.length; i++) {
    const dt = (frames[i].tMs - frames[i - 1].tMs) / 1000
    acc += frames[i].speedMs * dt
    result[i] = acc
  }
  return result
}

export function analyzeSegments(
  current: LapTrace,
  reference: LapTrace,
  segmentCount = DEFAULT_SEGMENT_COUNT,
): SegmentLoss[] {
  if (current.frames.length === 0 || reference.frames.length === 0) return []

  const curDist = integrateDistance(current.frames)
  const refDist = integrateDistance(reference.frames)
  const curTotal = curDist[curDist.length - 1]
  const refTotal = refDist[refDist.length - 1]
  const segLen = Math.min(curTotal, refTotal) / segmentCount

  const losses: SegmentLoss[] = []
  for (let s = 0; s < segmentCount; s++) {
    const startS = s * segLen
    const endS = (s + 1) * segLen
    const curStart = findFrameByDistance(current, curDist, startS)
    const curEnd = findFrameByDistance(current, curDist, endS)
    const refStart = findFrameByDistance(reference, refDist, startS)
    const refEnd = findFrameByDistance(reference, refDist, endS)
    const curMs = current.frames[curEnd].tMs - current.frames[curStart].tMs
    const refMs = reference.frames[refEnd].tMs - reference.frames[refStart].tMs
    const deltaMs = curMs - refMs
    if (deltaMs <= 2) continue

    const reason = classifyReason(
      current.frames.slice(curStart, curEnd + 1),
      reference.frames.slice(refStart, refEnd + 1),
    )
    losses.push({ segmentIndex: s, startS, endS, deltaMs, reason })
  }
  losses.sort((a, b) => b.deltaMs - a.deltaMs)
  return losses
}

function findFrameByDistance(lap: LapTrace, dist: number[], target: number): number {
  let lo = 0
  let hi = dist.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (dist[mid] < target) lo = mid + 1
    else hi = mid
  }
  return Math.max(0, Math.min(lap.frames.length - 1, lo))
}

function classifyReason(current: LapTrace['frames'], reference: LapTrace['frames']): LossReason {
  const avg = (frames: LapTrace['frames'], sel: (f: LapTrace['frames'][0]) => number) =>
    frames.reduce((s, f) => s + sel(f), 0) / Math.max(1, frames.length)

  const curSpeed = avg(current, f => f.speedMs)
  const refSpeed = avg(reference, f => f.speedMs)
  const curThrottle = avg(current, f => f.throttle)
  const refThrottle = avg(reference, f => f.throttle)
  const curBrake = avg(current, f => f.brake)
  const refBrake = avg(reference, f => f.brake)
  const curErs = avg(current, f => f.ersCharge)
  const refErs = avg(reference, f => f.ersCharge)

  if (curBrake > refBrake + 0.2 && curSpeed < refSpeed - 2) return 'braking_too_early'
  if (curBrake < refBrake - 0.2 && curSpeed > refSpeed + 2) return 'braking_too_late'
  if (curThrottle < refThrottle - 0.15) return 'lift_too_long'
  if (curSpeed < refSpeed - 4) return 'slow_apex'
  if (curErs < refErs - 0.15) return 'ers_misuse'
  return 'traction_loss'
}
