import { beforeEach, describe, expect, test } from 'vitest'
import { useTerrainStore } from '../stores/useTerrainStore'
import { queryTrackSurface } from './trackSurfaceQuery'

describe('queryTrackSurface', () => {
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

  test('flat empty terrain returns offroad with unit y normal', () => {
    const result = queryTrackSurface(0, 0)
    expect(result.height).toBe(0)
    expect(result.material).toBe('offroad')
    expect(result.normal[1]).toBeCloseTo(1, 6)
  })

  test('out-of-bounds query returns offroad sentinel', () => {
    const { worldSize } = useTerrainStore.getState()
    const out = worldSize
    const result = queryTrackSurface(out, out)
    expect(result.material).toBe('offroad')
    expect(result.height).toBe(0)
  })

  test('asphalt classification when roadbed magnitude exceeds shoulder threshold', () => {
    const state = useTerrainStore.getState()
    const roadbed = new Float32Array(state.resolution * state.resolution)
    // Fill a 4-cell neighbourhood so bilinear sampling resolves to -5.
    for (let i = 0; i < roadbed.length; i++) roadbed[i] = -5
    state.replaceRoadbed(roadbed)

    const result = queryTrackSurface(0, 0)
    expect(result.material).toBe('asphalt')
    expect(result.roadbedMagnitude).toBeCloseTo(5, 6)
    expect(result.height).toBeCloseTo(-5, 4)
  })

  test('shoulder classification for small roadbed magnitudes', () => {
    const state = useTerrainStore.getState()
    const roadbed = new Float32Array(state.resolution * state.resolution)
    const cellSize = state.worldSize / (state.resolution - 1)
    const halfSize = state.worldSize / 2
    const gx = Math.floor((0 + halfSize) / cellSize)
    const gz = Math.floor((0 + halfSize) / cellSize)
    roadbed[gz * state.resolution + gx] = 0.01
    state.replaceRoadbed(roadbed)

    // Query the grid intersection point exactly so we hit the cell
    // we set rather than its interpolated neighbours.
    const worldX = -halfSize + gx * cellSize
    const worldZ = -halfSize + gz * cellSize
    const result = queryTrackSurface(worldX, worldZ)
    expect(result.material).toBe('shoulder')
  })
})
