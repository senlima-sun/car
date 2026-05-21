import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTerrainStore } from '../stores/useTerrainStore'
import { __setSidecarLoadersForTest } from './terrainSidecar'
import { encodeMockSidecar } from './terrainSidecar.testUtils'
import { applyStampedSidecar } from './terrainStampedSidecar'

const RES = 256
const WORLD = 4000

function makeMockSidecar(fillValue: number) {
  const data = new Float32Array(RES * RES).fill(fillValue)
  return encodeMockSidecar({ data, verticalOriginMeters: 0 })
}

function resetTerrainStore(): void {
  useTerrainStore.setState({
    baseline: new Float32Array(RES * RES),
    delta: new Float32Array(RES * RES),
    resolution: RES,
    worldSize: WORLD,
    terrainGeneration: 0,
    sidecarApplied: false,
    customBaselineUsed: false,
    deltaPresent: false,
  })
}

describe('applyStampedSidecar', () => {
  beforeEach(() => {
    resetTerrainStore()
    __setSidecarLoadersForTest({})
  })

  afterEach(() => {
    resetTerrainStore()
  })

  it('returns { applied: false, rawHeightmap: null } when no sidecar loader exists', async () => {
    const result = await applyStampedSidecar('f1_unknown', [], { deltaPolicy: 'reset' })
    expect(result.applied).toBe(false)
    expect(result.rawHeightmap).toBeNull()
    expect(useTerrainStore.getState().sidecarApplied).toBe(false)
  })

  it('stamps and replaces baseline when sidecar exists', async () => {
    const sidecar = makeMockSidecar(42)
    __setSidecarLoadersForTest({
      '../constants/tracks/sources/_terrain/spa.heightmap.json': async () => ({
        default: sidecar,
      }),
    })
    const ribbon = {
      type: 'track_ribbon',
      ribbonPoints: [
        { x: -500, y: 0, z: 0, isPitLane: false },
        { x: 500, y: 0, z: 0, isPitLane: false },
      ],
      ribbonClosed: false,
      width: 50,
    }
    const result = await applyStampedSidecar('f1_spa', [ribbon], { deltaPolicy: 'reset' })
    expect(result.applied).toBe(true)
    expect(result.rawHeightmap).not.toBeNull()
    expect(result.rawHeightmap?.length).toBe(RES * RES)
    expect(useTerrainStore.getState().sidecarApplied).toBe(true)
    // Stamped baseline at (0, 0) should be the smoothed centerline value ≈ 42.
    const stampedAtCenter = useTerrainStore.getState().getHeightAt(0, 0)
    expect(stampedAtCenter).toBeCloseTo(42, 0)
  })

  it('honors deltaPolicy: reset (clears delta after stamp)', async () => {
    const sidecar = makeMockSidecar(10)
    __setSidecarLoadersForTest({
      '../constants/tracks/sources/_terrain/spa.heightmap.json': async () => ({
        default: sidecar,
      }),
    })
    // Pre-seed delta with user sculpt.
    useTerrainStore.getState().replaceDelta(
      Float32Array.from({ length: RES * RES }, (_, i) => (i === 100 ? 5 : 0)),
    )
    expect(useTerrainStore.getState().deltaPresent).toBe(true)

    await applyStampedSidecar(
      'f1_spa',
      [
        {
          type: 'track_ribbon',
          ribbonPoints: [
            { x: -500, y: 0, z: 0, isPitLane: false },
            { x: 500, y: 0, z: 0, isPitLane: false },
          ],
          width: 50,
          ribbonClosed: false,
        },
      ],
      { deltaPolicy: 'reset' },
    )
    expect(useTerrainStore.getState().deltaPresent).toBe(false)
  })

  it('honors deltaPolicy: preserve (keeps delta across re-stamp)', async () => {
    const sidecar = makeMockSidecar(10)
    __setSidecarLoadersForTest({
      '../constants/tracks/sources/_terrain/spa.heightmap.json': async () => ({
        default: sidecar,
      }),
    })
    useTerrainStore.getState().replaceDelta(
      Float32Array.from({ length: RES * RES }, (_, i) => (i === 100 ? 5 : 0)),
    )
    expect(useTerrainStore.getState().deltaPresent).toBe(true)

    await applyStampedSidecar(
      'f1_spa',
      [
        {
          type: 'track_ribbon',
          ribbonPoints: [
            { x: -500, y: 0, z: 0, isPitLane: false },
            { x: 500, y: 0, z: 0, isPitLane: false },
          ],
          width: 50,
          ribbonClosed: false,
        },
      ],
      { deltaPolicy: 'preserve' },
    )
    expect(useTerrainStore.getState().deltaPresent).toBe(true)
    expect(useTerrainStore.getState().delta[100]).toBe(5)
  })
})
