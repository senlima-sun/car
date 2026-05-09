export interface MouseSteeringConfig {
  gamma: number
  maxWheelAngleDeg: number
  decayRatePerSec: number
  sensitivityRadPerPx: number
  ratioAtRestKmh: number
  ratioAtTopKmh: number
}

export const DEFAULT_MOUSE_STEERING_CONFIG: MouseSteeringConfig = {
  gamma: 1.7,
  maxWheelAngleDeg: 540,
  decayRatePerSec: 6,
  sensitivityRadPerPx: 0.0035,
  ratioAtRestKmh: 1.0,
  ratioAtTopKmh: 0.5,
}

const SNAP_TO_ZERO_RAD = 1e-4
const RATIO_TOP_SPEED_KMH = 220
const RATIO_LOW_SPEED_KMH = 0

function isFiniteNumber(v: number): boolean {
  return Number.isFinite(v)
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

function smoothstep01(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

export function applyGammaCurve(s: number, gamma: number): number {
  if (!isFiniteNumber(s) || !isFiniteNumber(gamma) || gamma <= 0) return 0
  const sign = Math.sign(s)
  if (sign === 0) return 0
  const magnitude = Math.min(Math.abs(s), 1)
  return sign * Math.pow(magnitude, gamma)
}

export function accumulateWheelAngle(
  currentRad: number,
  deltaPx: number,
  sensitivity: number,
  maxRad: number,
): number {
  const safeCurrent = isFiniteNumber(currentRad) ? currentRad : 0
  const safeDelta = isFiniteNumber(deltaPx) ? deltaPx : 0
  const safeSensitivity = isFiniteNumber(sensitivity) ? sensitivity : 0
  const safeMax = isFiniteNumber(maxRad) && maxRad > 0 ? maxRad : 0
  const next = safeCurrent + safeDelta * safeSensitivity
  return clamp(next, -safeMax, safeMax)
}

export function applyDecay(currentRad: number, dt: number, decayRatePerSec: number): number {
  if (!isFiniteNumber(currentRad)) return 0
  if (!isFiniteNumber(dt) || dt <= 0) return currentRad
  if (!isFiniteNumber(decayRatePerSec) || decayRatePerSec <= 0) return currentRad
  const decayed = currentRad * Math.exp(-decayRatePerSec * dt)
  if (Math.abs(decayed) < SNAP_TO_ZERO_RAD) return 0
  return decayed
}

export function wheelAngleToSteer(wheelRad: number, maxWheelRad: number): number {
  if (!isFiniteNumber(wheelRad)) return 0
  if (!isFiniteNumber(maxWheelRad) || maxWheelRad <= 0) return 0
  return clamp(wheelRad / maxWheelRad, -1, 1)
}

export function applyVariableRatio(
  normalisedSteer: number,
  speedKmh: number,
  ratioAtRest: number,
  ratioAtTop: number,
): number {
  if (!isFiniteNumber(normalisedSteer)) return 0
  const safeSpeed = isFiniteNumber(speedKmh) ? Math.max(0, speedKmh) : 0
  const safeRest = isFiniteNumber(ratioAtRest) ? ratioAtRest : 1
  const safeTop = isFiniteNumber(ratioAtTop) ? ratioAtTop : 1
  const t = smoothstep01(
    (safeSpeed - RATIO_LOW_SPEED_KMH) / (RATIO_TOP_SPEED_KMH - RATIO_LOW_SPEED_KMH),
  )
  const ratio = safeRest + (safeTop - safeRest) * t
  return normalisedSteer * ratio
}
