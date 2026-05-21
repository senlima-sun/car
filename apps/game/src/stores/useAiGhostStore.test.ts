import { beforeEach, describe, expect, it } from 'vitest'
import { useAiGhostStore } from './useAiGhostStore'
import { CURRENT_GHOST_SCHEMA_VERSION, type GhostReplayData } from '@/utils/ghostReplayDB'

const makeReplay = (): GhostReplayData => ({
  schemaVersion: CURRENT_GHOST_SCHEMA_VERSION,
  trackId: 'monza',
  lapTime: 100000,
  frameCount: 2,
  positions: new Float32Array([0, 0, 0, 1, 0, 1]),
  rotations: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]),
  steerAngles: new Float32Array([0, 0]),
  wheelRotations: new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]),
  timestamps: new Float32Array([0, 50]),
})

describe('useAiGhostStore', () => {
  beforeEach(() => {
    useAiGhostStore.getState().clearReplay()
  })

  it('starts empty and unloaded', () => {
    const s = useAiGhostStore.getState()
    expect(s.replayData).toBeNull()
    expect(s.isLoaded).toBe(false)
    expect(s.ghostPosition).toBeNull()
    expect(s.ghostTimeDelta).toBeNull()
  })

  it('setReplay loads data and marks isLoaded', () => {
    const replay = makeReplay()
    useAiGhostStore.getState().setReplay(replay)
    const s = useAiGhostStore.getState()
    expect(s.replayData).toBe(replay)
    expect(s.isLoaded).toBe(true)
  })

  it('clearReplay wipes state back to initial', () => {
    useAiGhostStore.getState().setReplay(makeReplay())
    useAiGhostStore.getState().setGhostFrameState([1, 2, 3], 42)
    useAiGhostStore.getState().clearReplay()
    const s = useAiGhostStore.getState()
    expect(s.replayData).toBeNull()
    expect(s.isLoaded).toBe(false)
    expect(s.ghostPosition).toBeNull()
    expect(s.ghostTimeDelta).toBeNull()
  })

  it('setGhostFrameState updates pos + delta', () => {
    useAiGhostStore.getState().setGhostFrameState([1, 2, 3], 10)
    const s = useAiGhostStore.getState()
    expect(s.ghostPosition).toEqual([1, 2, 3])
    expect(s.ghostTimeDelta).toBe(10)
  })
})
