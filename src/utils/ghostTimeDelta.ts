import type { GhostReplayData } from './ghostReplayDB'

const MAX_DISTANCE_SQ = 50 * 50
const SCAN_WINDOW = 300

export interface GhostTimeDeltaResult {
  deltaMs: number
  distanceToGhost: number
}

export interface GhostTimeDeltaTracker {
  compute: (
    replay: GhostReplayData,
    playerPos: [number, number, number],
    currentLapTimeMs: number,
  ) => GhostTimeDeltaResult | null
  reset: () => void
}

export function createGhostTimeDeltaTracker(): GhostTimeDeltaTracker {
  let lastMatchIndex = 0

  function compute(
    replay: GhostReplayData,
    playerPos: [number, number, number],
    currentLapTimeMs: number,
  ): GhostTimeDeltaResult | null {
    const { frameCount, positions, timestamps } = replay
    if (frameCount < 2) return null

    const px = playerPos[0]
    const pz = playerPos[2]

    let bestIdx = -1
    let bestDistSq = Infinity

    const scanStart = Math.max(0, lastMatchIndex - SCAN_WINDOW)
    const scanEnd = Math.min(frameCount, lastMatchIndex + SCAN_WINDOW)

    for (let i = scanStart; i < scanEnd; i++) {
      const gx = positions[i * 3]
      const gz = positions[i * 3 + 2]
      const dx = gx - px
      const dz = gz - pz
      const distSq = dx * dx + dz * dz

      if (distSq < bestDistSq) {
        bestDistSq = distSq
        bestIdx = i
      }
    }

    if (bestIdx === -1 || bestDistSq > MAX_DISTANCE_SQ) return null

    lastMatchIndex = bestIdx

    const ghostTimestamp = timestamps[bestIdx]
    const deltaMs = currentLapTimeMs - ghostTimestamp

    return {
      deltaMs,
      distanceToGhost: Math.sqrt(bestDistSq),
    }
  }

  function reset() {
    lastMatchIndex = 0
  }

  return { compute, reset }
}
