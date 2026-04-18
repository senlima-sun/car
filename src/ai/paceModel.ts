import type { RacingLine } from '@/types/racingLine'
import { sampleRacingLine } from '@/types/racingLine'

export interface AiDriverProfile {
  id: string
  teamId: string
  driverName: string
  /** 0..1 skill rating. Higher values hit closer to line target speeds. */
  skill: number
  /** 0..1 aggression. Higher values brake later and defend more. */
  aggression: number
  /** 0..1 consistency. Lower values introduce more run-to-run variance. */
  consistency: number
  /** 0..1 tire management. Higher values slow marginally to preserve wear. */
  tireManagement: number
}

export interface AiPaceSample {
  targetSpeedMs: number
  throttle: number
  brake: number
}

/** Derive a target speed + throttle/brake request for an AI on a racing line. */
export function samplePace(
  profile: AiDriverProfile,
  line: RacingLine,
  sAlongLap: number,
  currentSpeedMs: number,
  tireGripMultiplier = 1,
): AiPaceSample {
  const wp = sampleRacingLine(line, sAlongLap)
  const skillFactor = 0.85 + profile.skill * 0.15
  const aggressionFactor = 0.95 + profile.aggression * 0.1
  const tireFactor = 1 - profile.tireManagement * 0.04
  const consistencyJitter = (1 - profile.consistency) * 0.08
  const jitter = 1 + (Math.random() - 0.5) * consistencyJitter

  const target = wp.targetSpeedMs * skillFactor * aggressionFactor * tireFactor * tireGripMultiplier * jitter

  let throttle = 0
  let brake = 0
  if (currentSpeedMs < target - 1.0) {
    throttle = Math.min(1, (target - currentSpeedMs) * 0.2)
  } else if (currentSpeedMs > target + 1.0) {
    brake = Math.min(1, (currentSpeedMs - target) * 0.15)
  } else {
    throttle = 0.6
  }

  return { targetSpeedMs: target, throttle, brake }
}
