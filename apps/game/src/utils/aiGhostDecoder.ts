import {
  CURRENT_GHOST_SCHEMA_VERSION,
  type GhostReplayData,
} from './ghostReplayDB'

export interface AiGhostSidecar {
  schemaVersion: number
  trackId: string
  lapTime: number
  frameCount: number
  recorderType?: string
  recordedAt?: string
}

const U32_BYTES = 4
const F32_BYTES = 4

export function encodeGhostBin(data: {
  frameCount: number
  positions: Float32Array
  rotations: Float32Array
  steerAngles: Float32Array
  wheelRotations: Float32Array
  timestamps: Float32Array
}): ArrayBuffer {
  const { frameCount, positions, rotations, steerAngles, wheelRotations, timestamps } = data
  const totalFloats = frameCount * 3 + frameCount * 4 + frameCount + frameCount * 4 + frameCount
  const totalBytes = U32_BYTES + totalFloats * F32_BYTES
  const buf = new ArrayBuffer(totalBytes)
  const view = new DataView(buf)
  view.setUint32(0, frameCount, true)

  let offset = U32_BYTES
  const writeSlice = (src: Float32Array, expectedLen: number) => {
    if (src.length < expectedLen) {
      throw new Error(
        `encodeGhostBin: expected ${expectedLen} floats, got ${src.length}`,
      )
    }
    new Float32Array(buf, offset, expectedLen).set(src.subarray(0, expectedLen))
    offset += expectedLen * F32_BYTES
  }

  writeSlice(positions, frameCount * 3)
  writeSlice(rotations, frameCount * 4)
  writeSlice(steerAngles, frameCount)
  writeSlice(wheelRotations, frameCount * 4)
  writeSlice(timestamps, frameCount)

  return buf
}

export function decodeGhostBin(buf: ArrayBuffer, sidecar: AiGhostSidecar): GhostReplayData {
  if (sidecar.schemaVersion > CURRENT_GHOST_SCHEMA_VERSION) {
    throw new Error(
      `decodeGhostBin: unsupported schemaVersion ${sidecar.schemaVersion} (current ${CURRENT_GHOST_SCHEMA_VERSION})`,
    )
  }
  if (buf.byteLength < U32_BYTES) {
    throw new Error('decodeGhostBin: buffer too small for frame count header')
  }

  const view = new DataView(buf)
  const frameCount = view.getUint32(0, true)
  if (frameCount !== sidecar.frameCount) {
    throw new Error(
      `decodeGhostBin: header frameCount=${frameCount} disagrees with sidecar frameCount=${sidecar.frameCount}`,
    )
  }

  const positionsLen = frameCount * 3
  const rotationsLen = frameCount * 4
  const steerLen = frameCount
  const wheelsLen = frameCount * 4
  const timestampsLen = frameCount
  const totalFloats = positionsLen + rotationsLen + steerLen + wheelsLen + timestampsLen
  const expectedBytes = U32_BYTES + totalFloats * F32_BYTES
  if (buf.byteLength < expectedBytes) {
    throw new Error(
      `decodeGhostBin: buffer too small (${buf.byteLength} bytes, need ${expectedBytes})`,
    )
  }

  let offset = U32_BYTES
  const readSlice = (length: number): Float32Array => {
    const slice = new Float32Array(buf.slice(offset, offset + length * F32_BYTES))
    offset += length * F32_BYTES
    return slice
  }

  const positions = readSlice(positionsLen)
  const rotations = readSlice(rotationsLen)
  const steerAngles = readSlice(steerLen)
  const wheelRotations = readSlice(wheelsLen)
  const timestamps = readSlice(timestampsLen)

  return {
    schemaVersion: sidecar.schemaVersion,
    trackId: sidecar.trackId,
    lapTime: sidecar.lapTime,
    frameCount,
    positions,
    rotations,
    steerAngles,
    wheelRotations,
    timestamps,
  }
}
