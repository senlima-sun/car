import { create } from 'zustand'

export type QualityTier = 'high' | 'medium' | 'low'

const TIER_THRESHOLDS = {
  high: 50,
  medium: 35,
} as const

const TIER_MULTIPLIERS: Record<QualityTier, number> = {
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
}

interface PerformanceActions {
  sampleFrame: (delta: number) => void
}

export const usePerformanceStore = create<PerformanceState & PerformanceActions>((set, get) => {
  const frameTimes: number[] = []
  let frameIdx = 0
  let filled = false

  return {
    tier: 'high',
    particleMultiplier: 1.0,
    trailPointsPerWheel: 600,
    avgFps: 60,

    sampleFrame(delta) {
      frameTimes[frameIdx] = delta
      frameIdx = (frameIdx + 1) % FRAME_SAMPLE_SIZE
      if (frameIdx === 0) filled = true

      if (!filled) return

      if (frameIdx % 30 !== 0) return

      let sum = 0
      for (let i = 0; i < FRAME_SAMPLE_SIZE; i++) sum += frameTimes[i]
      const avgDelta = sum / FRAME_SAMPLE_SIZE
      const fps = 1 / avgDelta

      const prev = get()

      let tier: QualityTier
      if (fps >= TIER_THRESHOLDS.high) tier = 'high'
      else if (fps >= TIER_THRESHOLDS.medium) tier = 'medium'
      else tier = 'low'

      if (tier === prev.tier) return

      const multiplier = TIER_MULTIPLIERS[tier]
      const trailPoints = tier === 'high' ? 600 : tier === 'medium' ? 400 : 200

      set({
        tier,
        particleMultiplier: multiplier,
        trailPointsPerWheel: trailPoints,
        avgFps: Math.round(fps),
      })
    },
  }
})
