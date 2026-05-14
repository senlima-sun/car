import { beforeEach, describe, expect, it } from 'bun:test'
import { useTerrainStore } from './useTerrainStore'

describe('useTerrainStore', () => {
  beforeEach(() => {
    const initial = useTerrainStore.getInitialState()
    useTerrainStore.setState({
      ...initial,
      heightmap: new Float32Array(initial.resolution * initial.resolution),
      version: 0,
      physicsVersion: 0,
    })
  })

  it('defers visual version bumps when brush updates are batched', () => {
    const index = 32 * useTerrainStore.getState().resolution + 32
    const changes = new Map<number, number>([[index, 3.5]])

    useTerrainStore.getState().applyBrushStroke(changes, { deferVersion: true })

    const deferredState = useTerrainStore.getState()
    expect(deferredState.heightmap[index]).toBe(3.5)
    expect(deferredState.version).toBe(0)

    deferredState.flushVisualVersion()

    expect(useTerrainStore.getState().version).toBe(1)
  })

  it('bumps visual version immediately for non-batched brush updates', () => {
    const index = 48 * useTerrainStore.getState().resolution + 48
    useTerrainStore.getState().applyBrushStroke(new Map<number, number>([[index, 1.25]]))

    const state = useTerrainStore.getState()
    expect(state.heightmap[index]).toBe(1.25)
    expect(state.version).toBe(1)
  })
})
