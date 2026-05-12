import { WHEELBASE } from '@/constants/dimensions'
import type { CarInput } from '@/wasm/PhysicsBridge'

export const LOOKAHEAD_BASE_M = 25
export const LOOKAHEAD_SPEED_GAIN = 0.6
export const LOOKAHEAD_MIN_M = 15
export const LOOKAHEAD_MAX_M = 80
export const LATERAL_G_LIMIT = 1.6
export const GRAVITY_MS2 = 9.81
export const MAX_STEER_ANGLE_RAD = 0.4

export interface AIDriverCenterlineSample {
  x: number
  z: number
  cumulativeDistance: number
}

export interface AIDriverState {
  position: [number, number, number]
  velocityMS: number
  heading: number
  centerlineSamples: AIDriverCenterlineSample[]
}

function normalizeAngle(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo
  if (value > hi) return hi
  return value
}

function findClosestSampleIndex(
  samples: AIDriverCenterlineSample[],
  x: number,
  z: number,
): number {
  let bestIndex = 0
  let bestDistSq = Number.POSITIVE_INFINITY
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!
    const dx = s.x - x
    const dz = s.z - z
    const d = dx * dx + dz * dz
    if (d < bestDistSq) {
      bestDistSq = d
      bestIndex = i
    }
  }
  return bestIndex
}

function advanceAlongCenterline(
  samples: AIDriverCenterlineSample[],
  startIndex: number,
  advanceMeters: number,
): { index: number; point: { x: number; z: number } } {
  const startDistance = samples[startIndex]!.cumulativeDistance
  const total = samples[samples.length - 1]!.cumulativeDistance
  const targetDistance = total > 0 ? (startDistance + advanceMeters) % total : startDistance

  let i = startIndex
  const n = samples.length
  for (let step = 0; step < n; step++) {
    const current = samples[i]!
    const next = samples[(i + 1) % n]!
    const currentD = current.cumulativeDistance
    const nextD =
      next.cumulativeDistance > currentD ? next.cumulativeDistance : currentD + 1e-6
    if (targetDistance >= currentD && targetDistance <= nextD) {
      const span = nextD - currentD
      const t = span > 1e-6 ? (targetDistance - currentD) / span : 0
      return {
        index: i,
        point: {
          x: current.x + (next.x - current.x) * t,
          z: current.z + (next.z - current.z) * t,
        },
      }
    }
    i = (i + 1) % n
  }
  const fallback = samples[startIndex]!
  return { index: startIndex, point: { x: fallback.x, z: fallback.z } }
}

function mengerCurvature(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
): number {
  const abx = bx - ax
  const abz = bz - az
  const bcx = cx - bx
  const bcz = cz - bz
  const cross = abx * bcz - abz * bcx
  const ab = Math.hypot(abx, abz)
  const bc = Math.hypot(bcx, bcz)
  const ca = Math.hypot(cx - ax, cz - az)
  const denom = ab * bc * ca
  if (denom < 1e-6) return 0
  return (2 * Math.abs(cross)) / denom
}

export function computeAIInput(state: AIDriverState): CarInput {
  const { position, velocityMS, heading, centerlineSamples } = state
  const [px, , pz] = position

  if (centerlineSamples.length < 2) {
    return {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false,
      handbrake: false,
      steer: 0,
      throttle: 0,
      brake_analog: 0,
    }
  }

  const closestIndex = findClosestSampleIndex(centerlineSamples, px, pz)

  const lookahead = clamp(
    LOOKAHEAD_BASE_M + LOOKAHEAD_SPEED_GAIN * velocityMS,
    LOOKAHEAD_MIN_M,
    LOOKAHEAD_MAX_M,
  )

  const { index: lookaheadIndex, point: lookaheadPoint } = advanceAlongCenterline(
    centerlineSamples,
    closestIndex,
    lookahead,
  )

  const dx = lookaheadPoint.x - px
  const dz = lookaheadPoint.z - pz
  const lookaheadDistance = Math.max(Math.hypot(dx, dz), 1e-3)
  const targetBearing = Math.atan2(dx, dz)
  const alpha = normalizeAngle(targetBearing - heading)

  const steeringAngleRad = Math.atan2(
    2 * WHEELBASE * Math.sin(alpha),
    lookaheadDistance,
  )
  const steer = clamp(steeringAngleRad / MAX_STEER_ANGLE_RAD, -1, 1)

  const n = centerlineSamples.length
  const prev = centerlineSamples[(lookaheadIndex - 1 + n) % n]!
  const curr = centerlineSamples[lookaheadIndex]!
  const next = centerlineSamples[(lookaheadIndex + 1) % n]!
  const curvature = mengerCurvature(prev.x, prev.z, curr.x, curr.z, next.x, next.z)

  const vTarget =
    curvature > 1e-6
      ? Math.sqrt((LATERAL_G_LIMIT * GRAVITY_MS2) / curvature)
      : Number.POSITIVE_INFINITY

  const throttleOn = velocityMS < vTarget * 0.95
  const brakeOn = velocityMS > vTarget * 1.1

  return {
    forward: throttleOn,
    backward: false,
    left: steer < -0.05,
    right: steer > 0.05,
    brake: brakeOn,
    handbrake: false,
    steer,
    throttle: throttleOn ? 1 : 0,
    brake_analog: brakeOn ? 1 : 0,
  }
}
