import { create } from 'zustand'

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low'

const TIER_UPGRADE_THRESHOLDS: Record<QualityTier, number> = {
  ultra: Infinity,
  high: 112,
  medium: 70,
  low: 48,
}

const TIER_DOWNGRADE_THRESHOLDS: Record<QualityTier, number> = {
  ultra: 92,
  high: 52,
  medium: 34,
  low: 0,
}

const TIER_UPGRADE_ONE_PERCENT_LOW_THRESHOLDS: Record<QualityTier, number> = {
  ultra: 94,
  high: 54,
  medium: 36,
  low: 0,
}

const TIER_ORDER: QualityTier[] = ['low', 'medium', 'high', 'ultra']
const TIER_CHANGE_COOLDOWN_SAMPLES = 8
const TIER_DOWNGRADE_SUSTAINED_SAMPLES = 6

const TIER_MULTIPLIERS: Record<QualityTier, number> = {
  ultra: 1.2,
  high: 1.0,
  medium: 0.6,
  low: 0.3,
}

const TIER_TRAIL_POINTS_PER_WHEEL: Record<QualityTier, number> = {
  ultra: 240,
  high: 180,
  medium: 100,
  low: 50,
}

const FRAME_SAMPLE_SIZE = 60

interface PerformanceState {
  tier: QualityTier
  particleMultiplier: number
  trailPointsPerWheel: number
  avgFps: number
  minFrameTime: number
  maxFrameTime: number
  avgFrameTime: number
  onePercentLowFps: number
  pointOnePercentLowFps: number
}

interface PerformanceActions {
  sampleFrame: (delta: number) => void
}

export function resolveQualityTier(
  currentTier: QualityTier,
  fps: number,
  onePercentLowFps: number,
  samplesSinceTierChange: number,
  badSampleStreak = TIER_DOWNGRADE_SUSTAINED_SAMPLES,
): QualityTier {
  const currentIndex = TIER_ORDER.indexOf(currentTier)

  if (
    currentIndex > 0 &&
    fps < TIER_DOWNGRADE_THRESHOLDS[currentTier] &&
    badSampleStreak >= TIER_DOWNGRADE_SUSTAINED_SAMPLES
  ) {
    return TIER_ORDER[currentIndex - 1]
  }

  if (samplesSinceTierChange < TIER_CHANGE_COOLDOWN_SAMPLES) return currentTier

  if (currentIndex < TIER_ORDER.length - 1) {
    const nextTier = TIER_ORDER[currentIndex + 1]
    if (
      fps >= TIER_UPGRADE_THRESHOLDS[currentTier] &&
      onePercentLowFps >= TIER_UPGRADE_ONE_PERCENT_LOW_THRESHOLDS[nextTier]
    ) {
      return nextTier
    }
  }

  return currentTier
}

export const usePerformanceStore = create<PerformanceState & PerformanceActions>(set => {
  const frameTimes: number[] = []
  let frameIdx = 0
  let filled = false
  let currentTier: QualityTier = 'ultra'
  let samplesSinceTierChange = TIER_CHANGE_COOLDOWN_SAMPLES
  let badSampleStreak = 0

  return {
    tier: 'ultra',
    particleMultiplier: 1.2,
    trailPointsPerWheel: TIER_TRAIL_POINTS_PER_WHEEL.ultra,
    avgFps: 120,
    minFrameTime: 0,
    maxFrameTime: 0,
    avgFrameTime: 0,
    onePercentLowFps: 0,
    pointOnePercentLowFps: 0,

    sampleFrame(delta) {
      frameTimes[frameIdx] = delta
      frameIdx = (frameIdx + 1) % FRAME_SAMPLE_SIZE
      if (frameIdx === 0) filled = true

      if (!filled) return

      if (frameIdx % 30 !== 0) return

      let sum = 0
      let min = Infinity
      let max = 0
      for (let i = 0; i < FRAME_SAMPLE_SIZE; i++) {
        const ft = frameTimes[i]
        sum += ft
        if (ft < min) min = ft
        if (ft > max) max = ft
      }
      const avgDelta = sum / FRAME_SAMPLE_SIZE
      const fps = 1 / avgDelta

      let worstFrame = 0
      for (let i = 0; i < FRAME_SAMPLE_SIZE; i++) {
        if (frameTimes[i] > worstFrame) worstFrame = frameTimes[i]
      }
      const onePercentLow = worstFrame > 0 ? 1 / worstFrame : 0
      const pointOnePercentLow = onePercentLow

      samplesSinceTierChange++
      const belowCurrentTierBudget =
        TIER_ORDER.indexOf(currentTier) > 0 && fps < TIER_DOWNGRADE_THRESHOLDS[currentTier]
      badSampleStreak = belowCurrentTierBudget ? badSampleStreak + 1 : 0

      const tier = resolveQualityTier(
        currentTier,
        fps,
        onePercentLow,
        samplesSinceTierChange,
        badSampleStreak,
      )
      if (tier !== currentTier) {
        currentTier = tier
        samplesSinceTierChange = 0
        badSampleStreak = 0
      }

      const multiplier = TIER_MULTIPLIERS[tier]
      set({
        tier,
        particleMultiplier: multiplier,
        trailPointsPerWheel: TIER_TRAIL_POINTS_PER_WHEEL[tier],
        avgFps: Math.round(fps),
        minFrameTime: min * 1000,
        maxFrameTime: max * 1000,
        avgFrameTime: avgDelta * 1000,
        onePercentLowFps: Math.round(onePercentLow),
        pointOnePercentLowFps: Math.round(pointOnePercentLow),
      })
    },
  }
})
