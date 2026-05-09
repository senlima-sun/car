import {
  accumulateWheelAngle,
  applyDecay,
  applyGammaCurve,
  applyVariableRatio,
  DEFAULT_MOUSE_STEERING_CONFIG,
  wheelAngleToSteer,
  type MouseSteeringConfig,
} from './steeringMath'

let wheelAngleRad = 0
let pendingDeltaPx = 0
let lockActive = false
let config: MouseSteeringConfig = { ...DEFAULT_MOUSE_STEERING_CONFIG }

function maxRad(): number {
  return (config.maxWheelAngleDeg * Math.PI) / 180
}

export function setSteeringConfig(c: MouseSteeringConfig): void {
  config = { ...c }
  const max = maxRad()
  if (wheelAngleRad > max) wheelAngleRad = max
  else if (wheelAngleRad < -max) wheelAngleRad = -max
}

export function getSteeringConfig(): MouseSteeringConfig {
  return config
}

export function isLockActive(): boolean {
  return lockActive
}

export function setSteeringLocked(locked: boolean): void {
  lockActive = locked
  if (!locked) {
    wheelAngleRad = 0
    pendingDeltaPx = 0
  }
}

export function handleSteeringMouseMove(e: MouseEvent): void {
  if (!lockActive) return
  pendingDeltaPx += e.movementX
}

export function readSteer(speedKmh: number, dt: number): number {
  const max = maxRad()
  if (pendingDeltaPx !== 0) {
    wheelAngleRad = accumulateWheelAngle(
      wheelAngleRad,
      pendingDeltaPx,
      config.sensitivityRadPerPx,
      max,
    )
    pendingDeltaPx = 0
  } else {
    wheelAngleRad = applyDecay(wheelAngleRad, dt, config.decayRatePerSec)
  }
  const normalised = wheelAngleToSteer(wheelAngleRad, max)
  const curved = applyGammaCurve(normalised, config.gamma)
  const final = applyVariableRatio(curved, speedKmh, config.ratioAtRest, config.ratioAtTopSpeed)
  return Number.isFinite(final) ? final : 0
}

export function getWheelAngleRad(): number {
  return wheelAngleRad
}

export function resetSteering(): void {
  wheelAngleRad = 0
  pendingDeltaPx = 0
  lockActive = false
}
