import { GHOST_SAMPLE_INTERVAL_MS, type GhostBuffers } from '@/stores/useGhostCarStore'

export const CURRENT_DEMO_SCHEMA_VERSION = 1

export interface HumanDemoData {
  schemaVersion: number
  trackId: string
  lapTime: number
  frameCount: number
  sampleIntervalMs: number
  positions: number[]
  rotations: number[]
  steerAngles: number[]
  wheelRotations: number[]
  timestamps: number[]
  throttles: number[]
  brakes: number[]
}

const floatArrayToNumberArray = (arr: Float32Array, length: number): number[] => {
  const out = new Array<number>(length)
  for (let i = 0; i < length; i++) out[i] = arr[i]
  return out
}

export function ghostBuffersToDemo(
  trackId: string,
  lapTime: number,
  buffers: GhostBuffers,
): HumanDemoData {
  const n = buffers.frameCount
  return {
    schemaVersion: CURRENT_DEMO_SCHEMA_VERSION,
    trackId,
    lapTime,
    frameCount: n,
    sampleIntervalMs: GHOST_SAMPLE_INTERVAL_MS,
    positions: floatArrayToNumberArray(buffers.positions, n * 3),
    rotations: floatArrayToNumberArray(buffers.rotations, n * 4),
    steerAngles: floatArrayToNumberArray(buffers.steerAngles, n),
    wheelRotations: floatArrayToNumberArray(buffers.wheelRotations, n * 4),
    timestamps: floatArrayToNumberArray(buffers.timestamps, n),
    throttles: floatArrayToNumberArray(buffers.throttles, n),
    brakes: floatArrayToNumberArray(buffers.brakes, n),
  }
}
