import { beforeEach, describe, expect, it } from 'bun:test'

import { useCustomizationStore } from './useCustomizationStore'
import { useTerrainStore } from './useTerrainStore'
import { useTrackStore } from './useTrackStore'
import { __setSidecarLoadersForTest } from '../utils/terrainSidecar'
import { encodeMockSidecar } from '../utils/terrainSidecar.testUtils'

const SPA_PRESET_ID = 'f1_spa'
const NO_SIDECAR_PRESET_ID = 'f1_madrid'

function resetStores(): void {
  useTrackStore.setState({
    trackLibrary: { version: 1, activeTrackId: null, tracks: [] },
    isLoading: false,
    loadedOnce: true,
    isDirty: false,
  })
  useCustomizationStore.getState().setPlacedObjects([])
  useTerrainStore.getState().resetHeightmap()
}

describe('useTrackStore — preset terrain bootstrap', () => {
  beforeEach(() => {
    resetStores()
    __setSidecarLoadersForTest({})
  })

  it('applies sidecar heightmap when a preset has one', async () => {
    const fakeHeights = new Float32Array(256 * 256)
    fakeHeights[5000] = 25
    __setSidecarLoadersForTest({
      '../constants/tracks/sources/_terrain/spa.heightmap.json': async () => ({
        default: encodeMockSidecar({ data: fakeHeights, verticalOriginMeters: 400 }),
      }),
    })

    await useTrackStore.getState().loadPresetTrack(SPA_PRESET_ID)

    const active = useTrackStore.getState().getActiveTrack()
    expect(active?.presetId).toBe(SPA_PRESET_ID)
    expect(active?.heightmapSource).toBe('sidecar')
    expect(active?.heightmap?.length).toBe(256 * 256)
    expect(useTerrainStore.getState().heightmap.some(h => h !== 0)).toBe(true)
  })

  it('leaves heightmap empty and source=none when no sidecar exists', async () => {
    __setSidecarLoadersForTest({})
    await useTrackStore.getState().loadPresetTrack(NO_SIDECAR_PRESET_ID)

    const active = useTrackStore.getState().getActiveTrack()
    expect(active?.heightmapSource).toBe('none')
    expect(active?.heightmap).toBeUndefined()
    expect(useTerrainStore.getState().heightmap.every(h => h === 0)).toBe(true)
  })

  it('saveCurrentTrack flips heightmapSource sidecar → user when the track is dirty', async () => {
    const fakeHeights = new Float32Array(256 * 256)
    fakeHeights[42] = 17
    __setSidecarLoadersForTest({
      '../constants/tracks/sources/_terrain/spa.heightmap.json': async () => ({
        default: encodeMockSidecar({ data: fakeHeights, verticalOriginMeters: 0 }),
      }),
    })

    await useTrackStore.getState().loadPresetTrack(SPA_PRESET_ID)
    expect(useTrackStore.getState().getActiveTrack()?.heightmapSource).toBe('sidecar')

    useTrackStore.getState().markDirty()
    useTrackStore.getState().saveCurrentTrack()

    const updated = useTrackStore.getState().getActiveTrack()
    expect(updated?.heightmapSource).toBe('user')
  })

  it('migrates pre-existing saved track (no heightmapSource) to "user" without applying sidecar', () => {
    const fakeHeights = new Float32Array(256 * 256)
    fakeHeights[100] = 12

    useTrackStore.setState({
      trackLibrary: {
        version: 1,
        activeTrackId: 'old-track',
        tracks: [
          {
            id: 'old-track',
            name: 'Old Saved Track',
            createdAt: 1,
            updatedAt: 1,
            objectCount: 0,
            objects: [],
            heightmap: Array.from(fakeHeights),
          },
        ],
      },
      isLoading: false,
      loadedOnce: true,
      isDirty: false,
    })

    __setSidecarLoadersForTest({
      '../constants/tracks/sources/_terrain/spa.heightmap.json': async () => ({
        default: encodeMockSidecar({
          data: new Float32Array(256 * 256).fill(99),
          verticalOriginMeters: 0,
        }),
      }),
    })

    useTrackStore.getState().loadTrack('old-track')

    const migrated = useTrackStore.getState().getTrackById('old-track')
    expect(migrated?.heightmapSource).toBe('user')
    expect(migrated?.heightmap?.[100]).toBe(12)
    expect(useTerrainStore.getState().heightmap[100]).toBe(12)
  })
})
