import { afterEach, describe, expect, test } from 'bun:test'
import { useValidationDriveStore } from './useValidationDriveStore'

const SAMPLES = [
  { x: 0, z: 0, cumulativeDistance: 0 },
  { x: 10, z: 0, cumulativeDistance: 10 },
]

afterEach(() => {
  useValidationDriveStore.getState().reset()
})

describe('useValidationDriveStore', () => {
  test('defaults to idle and disabled', () => {
    const s = useValidationDriveStore.getState()
    expect(s.enabled).toBe(false)
    expect(s.phase).toBe('idle')
    expect(s.centerlineSamples).toBeNull()
    expect(s.summary).toBeNull()
  })

  test('start transitions to driving with samples and clears prior failure', () => {
    useValidationDriveStore.getState().start('track-a', SAMPLES)
    const s = useValidationDriveStore.getState()
    expect(s.phase).toBe('driving')
    expect(s.enabled).toBe(true)
    expect(s.trackId).toBe('track-a')
    expect(s.centerlineSamples).toBe(SAMPLES)
    expect(s.startedAt).not.toBeNull()
    expect(s.offTrackSeconds).toBe(0)
  })

  test('complete transitions driving → completed and emits summary', () => {
    useValidationDriveStore.getState().start('track-a', SAMPLES)
    useValidationDriveStore.getState().tickOffTrack(2.5)
    useValidationDriveStore.getState().complete(95.4, 'replay-1')
    const s = useValidationDriveStore.getState()
    expect(s.phase).toBe('completed')
    expect(s.lapTimeSeconds).toBe(95.4)
    expect(s.summary).not.toBeNull()
    expect(s.summary?.phase).toBe('completed')
    expect(s.summary?.lapTimeSeconds).toBe(95.4)
    expect(s.summary?.offTrackSeconds).toBe(2.5)
    expect(s.summary?.replayId).toBe('replay-1')
  })

  test('complete is a no-op when not in driving phase', () => {
    useValidationDriveStore.getState().complete(80, null)
    expect(useValidationDriveStore.getState().phase).toBe('idle')
  })

  test('abort transitions any non-terminal phase to failed with reason', () => {
    useValidationDriveStore.getState().start('track-a', SAMPLES)
    useValidationDriveStore.getState().abort('timeout')
    const s = useValidationDriveStore.getState()
    expect(s.phase).toBe('failed')
    expect(s.failureReason).toBe('timeout')
    expect(s.summary?.phase).toBe('failed')
    expect(s.summary?.failureReason).toBe('timeout')
  })

  test('abort does not overwrite a completed run', () => {
    useValidationDriveStore.getState().start('track-a', SAMPLES)
    useValidationDriveStore.getState().complete(95, null)
    useValidationDriveStore.getState().abort('timeout')
    expect(useValidationDriveStore.getState().phase).toBe('completed')
  })

  test('tickOffTrack accumulates only during driving', () => {
    useValidationDriveStore.getState().tickOffTrack(1)
    expect(useValidationDriveStore.getState().offTrackSeconds).toBe(0)
    useValidationDriveStore.getState().start('track-a', SAMPLES)
    useValidationDriveStore.getState().tickOffTrack(1.5)
    useValidationDriveStore.getState().tickOffTrack(0.5)
    expect(useValidationDriveStore.getState().offTrackSeconds).toBe(2)
    useValidationDriveStore.getState().complete(90, null)
    useValidationDriveStore.getState().tickOffTrack(5)
    expect(useValidationDriveStore.getState().offTrackSeconds).toBe(2)
  })

  test('reset returns to idle with cleared state', () => {
    useValidationDriveStore.getState().start('track-a', SAMPLES)
    useValidationDriveStore.getState().abort('stuck')
    useValidationDriveStore.getState().reset()
    const s = useValidationDriveStore.getState()
    expect(s.phase).toBe('idle')
    expect(s.enabled).toBe(false)
    expect(s.trackId).toBeNull()
    expect(s.failureReason).toBeNull()
    expect(s.centerlineSamples).toBeNull()
    expect(s.summary).toBeNull()
    expect(s.offTrackSeconds).toBe(0)
  })
})
