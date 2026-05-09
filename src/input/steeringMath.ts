export interface MouseSteeringConfig {
  gamma: number
  maxWheelAngleDeg: number
  decayRatePerSec: number
  sensitivityRadPerPx: number
  ratioAtRest: number
  ratioAtTopSpeed: number
}

export const DEFAULT_MOUSE_STEERING_CONFIG: MouseSteeringConfig = {
  gamma: 1.7,
  maxWheelAngleDeg: 270,
  decayRatePerSec: 6,
  sensitivityRadPerPx: 0.01,
  ratioAtRest: 1.0,
  ratioAtTopSpeed: 0.5,
}

const SNAP_TO_ZERO_RAD = 1e-4
const RATIO_TOP_SPEED_KMH = 220

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
  if (!Number.isFinite(s) || !Number.isFinite(gamma) || gamma <= 0) return 0
  if (gamma === 1) return clamp(s, -1, 1)
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
  const safeCurrent = Number.isFinite(currentRad) ? currentRad : 0
  const safeDelta = Number.isFinite(deltaPx) ? deltaPx : 0
  const safeSensitivity = Number.isFinite(sensitivity) ? sensitivity : 0
  const safeMax = Number.isFinite(maxRad) && maxRad > 0 ? maxRad : 0
  const next = safeCurrent + safeDelta * safeSensitivity
  return clamp(next, -safeMax, safeMax)
}

export function applyDecay(currentRad: number, dt: number, decayRatePerSec: number): number {
  if (!Number.isFinite(currentRad)) return 0
  if (!Number.isFinite(dt) || !Number.isFinite(decayRatePerSec)) return currentRad
  if (decayRatePerSec < 0) return currentRad
  const decayed = currentRad * Math.exp(-decayRatePerSec * Math.max(0, dt))
  if (Math.abs(decayed) < SNAP_TO_ZERO_RAD) return 0
  return decayed
}

export function wheelAngleToSteer(wheelRad: number, maxWheelRad: number): number {
  if (!Number.isFinite(wheelRad)) return 0
  if (!Number.isFinite(maxWheelRad) || maxWheelRad <= 0) return 0
  return clamp(wheelRad / maxWheelRad, -1, 1)
}

export function applyVariableRatio(
  normalisedSteer: number,
  speedKmh: number,
  ratioAtRest: number,
  ratioAtTop: number,
): number {
  if (!Number.isFinite(normalisedSteer)) return 0
  const safeSpeed = Number.isFinite(speedKmh) ? Math.max(0, speedKmh) : 0
  const safeRest = Number.isFinite(ratioAtRest) ? ratioAtRest : 1
  const safeTop = Number.isFinite(ratioAtTop) ? ratioAtTop : 1
  const t = smoothstep01(safeSpeed / RATIO_TOP_SPEED_KMH)
  const ratio = safeRest + (safeTop - safeRest) * t
  return normalisedSteer * ratio
}
