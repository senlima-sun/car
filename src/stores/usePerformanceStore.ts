import { create } from 'zustand'

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low'

const TIER_THRESHOLDS = {
  ultra: 100,
  high: 60,
  medium: 40,
} as const

const TIER_MULTIPLIERS: Record<QualityTier, number> = {
  ultra: 1.2,
  high: 1.0,
  medium: 0.6,
  low: 0.3,
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

export const usePerformanceStore = create<PerformanceState & PerformanceActions>(set => {
  const frameTimes: number[] = []
  let frameIdx = 0
  let filled = false

  return {
    tier: 'ultra',
    particleMultiplier: 1.2,
    trailPointsPerWheel: 720,
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

      let tier: QualityTier
      if (fps >= TIER_THRESHOLDS.ultra) tier = 'ultra'
      else if (fps >= TIER_THRESHOLDS.high) tier = 'high'
      else if (fps >= TIER_THRESHOLDS.medium) tier = 'medium'
      else tier = 'low'

      const multiplier = TIER_MULTIPLIERS[tier]
      const trailPoints =
        tier === 'ultra' ? 720 : tier === 'high' ? 600 : tier === 'medium' ? 400 : 200

      set({
        tier,
        particleMultiplier: multiplier,
        trailPointsPerWheel: trailPoints,
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
