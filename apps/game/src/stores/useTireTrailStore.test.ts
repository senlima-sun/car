import { beforeEach, describe, expect, test } from 'vitest'
import { MAX_POINTS_PER_WHEEL, useTireTrailStore, type TireTrailPoint } from './useTireTrailStore'

const points: TireTrailPoint[] = [
  {
    wheel: 0,
    x: 1,
    z: 2,
    y: 0.1,
    dirX: 1,
    dirZ: 0,
    intensity: 0.8,
    width: 0.3,
    isWet: false,
  },
  {
    wheel: 1,
    x: 3,
    z: 4,
    y: 0.2,
    dirX: 0,
    dirZ: 1,
    intensity: 0.6,
    width: 0.4,
    isWet: true,
  },
]

describe('useTireTrailStore', () => {
  beforeEach(() => {
    useTireTrailStore.getState().clear()
  })

  test('addPoints batches trail mutations into one version bump', () => {
    const before = useTireTrailStore.getState().version

    useTireTrailStore.getState().addPoints(points, points.length)

    const state = useTireTrailStore.getState()
    expect(state.version).toBe(before + 1)
    expect(state.counts[0]).toBe(1)
    expect(state.counts[1]).toBe(1)
    expect(state.xs[0]).toBe(1)
    expect(state.zs[0]).toBe(2)
    expect(state.wet[MAX_POINTS_PER_WHEEL]).toBe(1)
  })
})
