import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { useTerrainStore } from '../stores/useTerrainStore'
import {
  __setSidecarLoadersForTest,
  type TerrainSidecar,
} from './terrainSidecar'
import { applyStampedSidecar } from './terrainStampedSidecar'

const RES = 256
const WORLD = 4000

function makeMockSidecar(fillValue: number): TerrainSidecar {
  // Encode a constant-height heightmap as base64 int16-cm.
  const ints = new Int16Array(RES * RES)
  const cm = Math.round(fillValue * 100)
  for (let i = 0; i < ints.length; i++) ints[i] = cm
  const bytes = new Uint8Array(ints.buffer, ints.byteOffset, ints.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return {
    version: 1,
    resolution: RES,
    worldSize: WORLD,
    encoding: 'int16-cm',
    verticalOriginMeters: 0,
    centerLat: 0,
    centerLon: 0,
    halfExtentMeters: 1300,
    provider: 'mock',
    dem: 'mock',
    datum: 'EGM2008',
    data:
      typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(binary),
  }
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
