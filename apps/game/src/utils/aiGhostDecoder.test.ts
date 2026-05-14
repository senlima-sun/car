import { describe, expect, it } from 'bun:test'
import { CURRENT_GHOST_SCHEMA_VERSION } from './ghostReplayDB'
import { type AiGhostSidecar, decodeGhostBin, encodeGhostBin } from './aiGhostDecoder'

const makeSyntheticFrames = (frameCount: number) => {
  const positions = new Float32Array(frameCount * 3)
  const rotations = new Float32Array(frameCount * 4)
  const steerAngles = new Float32Array(frameCount)
  const wheelRotations = new Float32Array(frameCount * 4)
  const timestamps = new Float32Array(frameCount)
  for (let i = 0; i < frameCount; i++) {
    positions[i * 3] = i * 1.5
    positions[i * 3 + 1] = 0.25
    positions[i * 3 + 2] = -i * 0.5
    rotations[i * 4] = 0
    rotations[i * 4 + 1] = Math.sin(i * 0.01)
    rotations[i * 4 + 2] = 0
    rotations[i * 4 + 3] = Math.cos(i * 0.01)
    steerAngles[i] = Math.sin(i * 0.05) * 0.3
    wheelRotations[i * 4] = i * 0.1
    wheelRotations[i * 4 + 1] = i * 0.1 + 0.01
    wheelRotations[i * 4 + 2] = i * 0.1 + 0.02
    wheelRotations[i * 4 + 3] = i * 0.1 + 0.03
    timestamps[i] = i * 50
  }
  return { frameCount, positions, rotations, steerAngles, wheelRotations, timestamps }
}

describe('aiGhostDecoder round-trip', () => {
  it('encodes then decodes a synthetic 100-frame replay with bit-exact fidelity', () => {
    const frames = makeSyntheticFrames(100)
    const buf = encodeGhostBin(frames)
    const sidecar: AiGhostSidecar = {
      schemaVersion: CURRENT_GHOST_SCHEMA_VERSION,
      trackId: 'synthetic',
      lapTime: 123456,
      frameCount: frames.frameCount,
      recorderType: 'ai_runner',
    }
    const decoded = decodeGhostBin(buf, sidecar)

    expect(decoded.frameCount).toBe(frames.frameCount)
    expect(decoded.schemaVersion).toBe(CURRENT_GHOST_SCHEMA_VERSION)
    expect(decoded.trackId).toBe('synthetic')
    expect(decoded.lapTime).toBe(123456)
    expect(Array.from(decoded.positions)).toEqual(Array.from(frames.positions))
    expect(Array.from(decoded.rotations)).toEqual(Array.from(frames.rotations))
    expect(Array.from(decoded.steerAngles)).toEqual(Array.from(frames.steerAngles))
    expect(Array.from(decoded.wheelRotations)).toEqual(Array.from(frames.wheelRotations))
    expect(Array.from(decoded.timestamps)).toEqual(Array.from(frames.timestamps))
  })

  it('throws when sidecar schemaVersion exceeds current', () => {
    const frames = makeSyntheticFrames(2)
    const buf = encodeGhostBin(frames)
    const sidecar: AiGhostSidecar = {
      schemaVersion: CURRENT_GHOST_SCHEMA_VERSION + 1,
      trackId: 'x',
      lapTime: 1,
      frameCount: frames.frameCount,
    }
    expect(() => decodeGhostBin(buf, sidecar)).toThrow()
  })

  it('throws on header / sidecar frameCount mismatch', () => {
    const frames = makeSyntheticFrames(4)
    const buf = encodeGhostBin(frames)
    const sidecar: AiGhostSidecar = {
      schemaVersion: CURRENT_GHOST_SCHEMA_VERSION,
      trackId: 'x',
      lapTime: 1,
      frameCount: 5,
    }
    expect(() => decodeGhostBin(buf, sidecar)).toThrow()
  })

  it('throws when buffer is truncated', () => {
    const frames = makeSyntheticFrames(10)
    const buf = encodeGhostBin(frames)
    const truncated = buf.slice(0, buf.byteLength - 16)
    const sidecar: AiGhostSidecar = {
      schemaVersion: CURRENT_GHOST_SCHEMA_VERSION,
      trackId: 'x',
      lapTime: 1,
      frameCount: frames.frameCount,
    }
    expect(() => decodeGhostBin(truncated, sidecar)).toThrow()
  })
})
