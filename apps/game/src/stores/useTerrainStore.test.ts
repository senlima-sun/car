import { beforeEach, describe, expect, it } from 'bun:test'
import { useTerrainStore } from './useTerrainStore'

describe('useTerrainStore', () => {
  beforeEach(() => {
    const initial = useTerrainStore.getInitialState()
    useTerrainStore.setState({
      ...initial,
      baseline: new Float32Array(initial.resolution * initial.resolution),
      delta: new Float32Array(initial.resolution * initial.resolution),
      terrainGeneration: 0,
      sidecarApplied: false,
      customBaselineUsed: false,
      deltaPresent: false,
    })
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
})
