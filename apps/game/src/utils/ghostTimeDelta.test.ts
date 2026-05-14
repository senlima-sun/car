import { describe, it, expect } from 'bun:test'
import { createGhostTimeDeltaTracker } from './ghostTimeDelta'
import type { GhostReplayData } from './ghostReplayDB'

function makeReplay(frames: { x: number; z: number; t: number }[]): GhostReplayData {
  const frameCount = frames.length
  const positions = new Float32Array(frameCount * 3)
  const rotations = new Float32Array(frameCount * 4)
  const steerAngles = new Float32Array(frameCount)
  const wheelRotations = new Float32Array(frameCount * 4)
  const timestamps = new Float32Array(frameCount)

  for (let i = 0; i < frameCount; i++) {
    positions[i * 3] = frames[i].x
    positions[i * 3 + 1] = 0
    positions[i * 3 + 2] = frames[i].z
    rotations[i * 4 + 3] = 1
    timestamps[i] = frames[i].t
  }

  return {
    schemaVersion: 1,
    trackId: 'test',
    lapTime: frames[frameCount - 1]?.t ?? 0,
    frameCount,
    positions,
    rotations,
    steerAngles,
    wheelRotations,
    timestamps,
  }
}

describe('createGhostTimeDeltaTracker', () => {
  it('returns null for empty replay', () => {
    const tracker = createGhostTimeDeltaTracker()
    const replay = makeReplay([])
    const result = tracker.compute(replay, [0, 0, 0], 1000)
    expect(result).toBeNull()
  })

  it('returns null for single-frame replay', () => {
    const tracker = createGhostTimeDeltaTracker()
    const replay = makeReplay([{ x: 0, z: 0, t: 0 }])
    const result = tracker.compute(replay, [0, 0, 0], 1000)
    expect(result).toBeNull()
  })

  it('returns negative delta when player is ahead of ghost', () => {
    const tracker = createGhostTimeDeltaTracker()
    const replay = makeReplay([
      { x: 0, z: 0, t: 0 },
      { x: 10, z: 0, t: 1000 },
      { x: 20, z: 0, t: 2000 },
      { x: 30, z: 0, t: 3000 },
      { x: 40, z: 0, t: 4000 },
    ])
    const result = tracker.compute(replay, [30, 0, 0], 2500)
    expect(result).not.toBeNull()
    expect(result!.deltaMs).toBeLessThan(0)
  })

  it('returns positive delta when player is behind ghost', () => {
    const tracker = createGhostTimeDeltaTracker()
    const replay = makeReplay([
      { x: 0, z: 0, t: 0 },
      { x: 10, z: 0, t: 1000 },
      { x: 20, z: 0, t: 2000 },
      { x: 30, z: 0, t: 3000 },
      { x: 40, z: 0, t: 4000 },
    ])
    const result = tracker.compute(replay, [10, 0, 0], 2500)
    expect(result).not.toBeNull()
    expect(result!.deltaMs).toBeGreaterThan(0)
  })

  it('returns null when player is more than 50m away from track', () => {
    const tracker = createGhostTimeDeltaTracker()
    const replay = makeReplay([
      { x: 0, z: 0, t: 0 },
      { x: 10, z: 0, t: 1000 },
      { x: 20, z: 0, t: 2000 },
    ])
    const result = tracker.compute(replay, [0, 0, 100], 1000)
    expect(result).toBeNull()
  })

  it('uses lastMatchIndex for locality optimization', () => {
    const tracker = createGhostTimeDeltaTracker()
    const frames = []
    for (let i = 0; i < 1000; i++) {
      frames.push({ x: i, z: 0, t: i * 10 })
    }
    const replay = makeReplay(frames)

    const r1 = tracker.compute(replay, [100, 0, 0], 1000)
    expect(r1).not.toBeNull()
    expect(r1!.deltaMs).toBe(0)

    const r2 = tracker.compute(replay, [110, 0, 0], 1100)
    expect(r2).not.toBeNull()
    expect(r2!.deltaMs).toBe(0)

    const r3 = tracker.compute(replay, [120, 0, 0], 1300)
    expect(r3).not.toBeNull()
    expect(r3!.deltaMs).toBeGreaterThan(0)
  })

  it('reset clears lastMatchIndex', () => {
    const tracker = createGhostTimeDeltaTracker()
    const frames = []
    for (let i = 0; i < 1000; i++) {
      frames.push({ x: i, z: 0, t: i * 10 })
    }
    const replay = makeReplay(frames)

    tracker.compute(replay, [500, 0, 0], 5000)

    tracker.reset()

    const result = tracker.compute(replay, [5, 0, 0], 50)
    expect(result).not.toBeNull()
    expect(result!.deltaMs).toBe(0)
  })

  it('reports correct distanceToGhost', () => {
    const tracker = createGhostTimeDeltaTracker()
    const replay = makeReplay([
      { x: 0, z: 0, t: 0 },
      { x: 10, z: 0, t: 1000 },
    ])
    const result = tracker.compute(replay, [10, 0, 3], 1000)
    expect(result).not.toBeNull()
    expect(result!.distanceToGhost).toBeCloseTo(3, 1)
  })
})
