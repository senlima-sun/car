import { beforeEach, describe, expect, it } from 'vitest'
import { useGhostCarStore } from './useGhostCarStore'
import { useLapTimeStore } from './useLapTimeStore'

const enableRecording = () => {
  useLapTimeStore.setState({
    isRecording: true,
    currentLapStart: performance.now() - 10_000,
  })
}

const disableRecording = () => {
  useLapTimeStore.setState({
    isRecording: false,
    currentLapStart: null,
  })
}

const resetGhost = () => {
  const store = useGhostCarStore.getState()
  store.ghostThrottles.fill(0)
  store.ghostBrakes.fill(0)
  store.ghostSteerAngles.fill(0)
  useGhostCarStore.setState({
    ghostHead: 0,
    ghostLastSampleTime: 0,
  })
}

describe('useGhostCarStore.recordGhostFrame with throttle + brake', () => {
  beforeEach(() => {
    resetGhost()
    enableRecording()
  })

  it('writes throttle and brake at the current head index', () => {
    const store = useGhostCarStore.getState()
    for (let i = 0; i < 3; i++) {
      useGhostCarStore.setState({ ghostLastSampleTime: 0 })
      store.recordGhostFrame(
        i,
        0,
        0,
        0,
        0,
        0,
        1,
        0.1 * i,
        [0, 0, 0, 0],
        0.7,
        0.3,
      )
    }
    const buffers = store.getGhostBuffers()
    expect(buffers.frameCount).toBe(3)
    expect(buffers.throttles.length).toBe(3)
    expect(buffers.brakes.length).toBe(3)
    for (let i = 0; i < 3; i++) {
      expect(buffers.throttles[i]).toBeCloseTo(0.7, 5)
      expect(buffers.brakes[i]).toBeCloseTo(0.3, 5)
    }
  })

  it('returns empty throttle/brake arrays when nothing recorded', () => {
    const buffers = useGhostCarStore.getState().getGhostBuffers()
    expect(buffers.frameCount).toBe(0)
    expect(buffers.throttles.length).toBe(0)
    expect(buffers.brakes.length).toBe(0)
  })

  it('does not record when lap recording is inactive', () => {
    disableRecording()
    useGhostCarStore.getState().recordGhostFrame(
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      [0, 0, 0, 0],
      0.5,
      0.5,
    )
    expect(useGhostCarStore.getState().ghostHead).toBe(0)
  })

  it('resetGhostRecording clears the head so next write starts at index 0', () => {
    const store = useGhostCarStore.getState()
    useGhostCarStore.setState({ ghostLastSampleTime: 0 })
    store.recordGhostFrame(0, 0, 0, 0, 0, 0, 1, 0, [0, 0, 0, 0], 0.9, 0.1)
    expect(useGhostCarStore.getState().ghostHead).toBe(1)

    store.resetGhostRecording()
    expect(useGhostCarStore.getState().ghostHead).toBe(0)

    useGhostCarStore.setState({ ghostLastSampleTime: 0 })
    store.recordGhostFrame(0, 0, 0, 0, 0, 0, 1, 0, [0, 0, 0, 0], 0.4, 0.6)
    const buffers = useGhostCarStore.getState().getGhostBuffers()
    expect(buffers.frameCount).toBe(1)
    expect(buffers.throttles[0]).toBeCloseTo(0.4, 5)
    expect(buffers.brakes[0]).toBeCloseTo(0.6, 5)
  })
})
