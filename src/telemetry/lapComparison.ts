import { TELEMETRY_STRIDE, CH } from './channels'

export interface LapDelta {
  distances: Float32Array
  timeDelta: Float32Array
  frameCount: number
}

export function computeLapDelta(
  baseData: Float32Array,
  baseFrameCount: number,
  compareData: Float32Array,
  compareFrameCount: number,
): LapDelta {
  const distances = new Float32Array(baseFrameCount)
  const timeDelta = new Float32Array(baseFrameCount)

  for (let i = 0; i < baseFrameCount; i++) {
    const baseDist = baseData[i * TELEMETRY_STRIDE + CH.DISTANCE]
    const baseTime = baseData[i * TELEMETRY_STRIDE + CH.TIMESTAMP]
    distances[i] = baseDist

    const cmpTime = interpolateAtDistance(compareData, compareFrameCount, baseDist)
    timeDelta[i] = baseTime - cmpTime
  }

  return { distances, timeDelta, frameCount: baseFrameCount }
}

function interpolateAtDistance(
  data: Float32Array,
  frameCount: number,
  targetDist: number,
): number {
  if (frameCount === 0) return 0

  let lo = 0
  let hi = frameCount - 1

  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (data[mid * TELEMETRY_STRIDE + CH.DISTANCE] < targetDist) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  if (lo === 0) return data[CH.TIMESTAMP]
  if (lo >= frameCount) return data[(frameCount - 1) * TELEMETRY_STRIDE + CH.TIMESTAMP]

  const d0 = data[(lo - 1) * TELEMETRY_STRIDE + CH.DISTANCE]
  const d1 = data[lo * TELEMETRY_STRIDE + CH.DISTANCE]
  const t0 = data[(lo - 1) * TELEMETRY_STRIDE + CH.TIMESTAMP]
  const t1 = data[lo * TELEMETRY_STRIDE + CH.TIMESTAMP]

  const range = d1 - d0
  if (range < 0.001) return t0

  const t = (targetDist - d0) / range
  return t0 + t * (t1 - t0)
}
