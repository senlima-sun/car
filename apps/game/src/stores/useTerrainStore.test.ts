import { beforeEach, describe, expect, it } from 'vitest'
import { useTerrainStore } from './useTerrainStore'

describe('useTerrainStore', () => {
  beforeEach(() => {
    const initial = useTerrainStore.getInitialState()
    useTerrainStore.setState({
      ...initial,
      baseline: new Float32Array(initial.resolution * initial.resolution),
      delta: new Float32Array(initial.resolution * initial.resolution),
      roadbed: new Float32Array(initial.resolution * initial.resolution),
      terrainGeneration: 0,
      sidecarApplied: false,
      customBaselineUsed: false,
      deltaPresent: false,
      roadbedPresent: false,
    })
  })

  it('replaceRoadbed adds to composed height and is independent of delta', () => {
    const res = useTerrainStore.getState().resolution
    const baseline = new Float32Array(res * res)
    baseline[0] = 2
    useTerrainStore.getState().replaceBaseline(baseline, { source: 'sidecar' })
    useTerrainStore.getState().applyDeltaStroke(new Map<number, number>([[0, 5]]))

    const roadbed = new Float32Array(res * res)
    roadbed[0] = -1.25
    useTerrainStore.getState().replaceRoadbed(roadbed)

    const state = useTerrainStore.getState()
    expect(state.roadbedPresent).toBe(true)
    expect(state.getComposedHeightsSnapshot()[0]).toBeCloseTo(3.75, 5)
    expect(state.delta[0]).toBe(3)
  })

  it('resetRoadbed clears roadbed layer without touching baseline or delta', () => {
    const res = useTerrainStore.getState().resolution
    const roadbed = new Float32Array(res * res)
    roadbed[0] = 2
    useTerrainStore.getState().replaceRoadbed(roadbed)
    expect(useTerrainStore.getState().roadbedPresent).toBe(true)

    useTerrainStore.getState().resetRoadbed()
    const state = useTerrainStore.getState()
    expect(state.roadbedPresent).toBe(false)
    expect(state.roadbed[0]).toBe(0)
  })

  it('defers terrainGeneration bumps when delta strokes are batched', () => {
    const index = 32 * useTerrainStore.getState().resolution + 32
    const changes = new Map<number, number>([[index, 3.5]])

    useTerrainStore.getState().applyDeltaStroke(changes, { deferGeneration: true })

    const deferredState = useTerrainStore.getState()
    expect(deferredState.getComposedHeightsSnapshot()[index]).toBe(3.5)
    expect(deferredState.terrainGeneration).toBe(0)

    deferredState.commitGeneration()

    expect(useTerrainStore.getState().terrainGeneration).toBe(1)
  })

  it('bumps terrainGeneration immediately for non-batched delta strokes', () => {
    const index = 48 * useTerrainStore.getState().resolution + 48
    useTerrainStore.getState().applyDeltaStroke(new Map<number, number>([[index, 1.25]]))

    const state = useTerrainStore.getState()
    expect(state.getComposedHeightsSnapshot()[index]).toBe(1.25)
    expect(state.terrainGeneration).toBe(1)
  })

  it('applyDeltaStroke stores delta = target - baseline (supports lowering below sidecar)', () => {
    const index = 64 * useTerrainStore.getState().resolution + 64
    useTerrainStore.getState().replaceBaseline(
      (() => {
        const arr = new Float32Array(useTerrainStore.getState().resolution ** 2)
        arr[index] = 10
        return arr
      })(),
      { source: 'sidecar' },
    )

    useTerrainStore.getState().applyDeltaStroke(new Map<number, number>([[index, -5]]))

    const state = useTerrainStore.getState()
    expect(state.delta[index]).toBe(-15)
    expect(state.getHeightAt((index % state.resolution) * 0, 0)).toBeDefined()
    expect(state.getComposedHeightsSnapshot()[index]).toBe(-5)
  })

  it('replaceBaseline with source=sidecar sets sidecarApplied; custom sets customBaselineUsed', () => {
    const res = useTerrainStore.getState().resolution
    useTerrainStore.getState().replaceBaseline(new Float32Array(res * res), { source: 'sidecar' })
    expect(useTerrainStore.getState().sidecarApplied).toBe(true)
    expect(useTerrainStore.getState().customBaselineUsed).toBe(false)

    useTerrainStore.getState().replaceBaseline(new Float32Array(res * res), { source: 'custom' })
    expect(useTerrainStore.getState().sidecarApplied).toBe(false)
    expect(useTerrainStore.getState().customBaselineUsed).toBe(true)
  })

  it('resetDelta clears delta and unsets deltaPresent', () => {
    const index = 16 * useTerrainStore.getState().resolution + 16
    useTerrainStore.getState().applyDeltaStroke(new Map<number, number>([[index, 5]]))
    expect(useTerrainStore.getState().deltaPresent).toBe(true)

    useTerrainStore.getState().resetDelta()
    expect(useTerrainStore.getState().deltaPresent).toBe(false)
    expect(useTerrainStore.getState().delta[index]).toBe(0)
  })

  it('getComposedHeightsSnapshot returns baseline + delta', () => {
    const res = useTerrainStore.getState().resolution
    const baseline = new Float32Array(res * res)
    baseline[0] = 7
    useTerrainStore.getState().replaceBaseline(baseline, { source: 'custom' })
    useTerrainStore.getState().applyDeltaStroke(new Map<number, number>([[0, 12]]))

    const snapshot = useTerrainStore.getState().getComposedHeightsSnapshot()
    expect(snapshot[0]).toBe(12)
  })

  describe('getHeightAt boundary', () => {
    function fillTiltedPlane(slopePerMeter: number): void {
      const { resolution, worldSize } = useTerrainStore.getState()
      const baseline = new Float32Array(resolution * resolution)
      const cellSize = worldSize / (resolution - 1)
      const half = worldSize / 2
      for (let gz = 0; gz < resolution; gz++) {
        for (let gx = 0; gx < resolution; gx++) {
          const wx = -half + gx * cellSize
          baseline[gz * resolution + gx] = wx * slopePerMeter
        }
      }
      useTerrainStore.getState().replaceBaseline(baseline, { source: 'custom' })
    }

    it('returns interpolated value at the world origin', () => {
      fillTiltedPlane(0.1)
      expect(useTerrainStore.getState().getHeightAt(0, 0)).toBeCloseTo(0, 5)
    })

    it('returns the edge value when sampling exactly on each edge', () => {
      fillTiltedPlane(0.1)
      const { worldSize } = useTerrainStore.getState()
      const half = worldSize / 2
      const get = useTerrainStore.getState().getHeightAt
      expect(get(half, 0)).toBeCloseTo(half * 0.1, 1)
      expect(get(-half, 0)).toBeCloseTo(-half * 0.1, 1)
      expect(get(0, half)).toBeCloseTo(0, 1)
      expect(get(0, -half)).toBeCloseTo(0, 1)
    })

    it('clamps to the nearest edge value when sampling 100m past the boundary', () => {
      fillTiltedPlane(0.1)
      const { worldSize } = useTerrainStore.getState()
      const half = worldSize / 2
      const get = useTerrainStore.getState().getHeightAt
      const edgeHigh = get(half, 0)
      const edgeLow = get(-half, 0)
      expect(get(half + 100, 0)).toBeCloseTo(edgeHigh, 1)
      expect(get(-half - 100, 0)).toBeCloseTo(edgeLow, 1)
    })

    it('still returns a finite value 100km past the boundary', () => {
      fillTiltedPlane(0.1)
      const get = useTerrainStore.getState().getHeightAt
      const y = get(1e5, 1e5)
      expect(Number.isFinite(y)).toBe(true)
      expect(Number.isNaN(y)).toBe(false)
    })

    it('does not collapse to 0 outside the grid when the heightmap has positive baseline', () => {
      const { resolution } = useTerrainStore.getState()
      const baseline = new Float32Array(resolution * resolution)
      for (let i = 0; i < baseline.length; i++) baseline[i] = 30
      useTerrainStore.getState().replaceBaseline(baseline, { source: 'custom' })
      const get = useTerrainStore.getState().getHeightAt
      expect(get(1e4, 1e4)).toBeCloseTo(30, 5)
      expect(get(-1e4, -1e4)).toBeCloseTo(30, 5)
    })
  })
})
