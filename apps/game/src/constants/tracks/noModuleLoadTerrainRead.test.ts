import { describe, expect, test } from 'vitest'

describe('preset tracks module load', () => {
  test('does not invoke useTerrainStore.getState() during import', async () => {
    const calls: string[] = []
    const originalGetState = (await import('@/stores/useTerrainStore')).useTerrainStore.getState
    const proxy = (() => {
      calls.push('getState')
      return originalGetState()
    }) as typeof originalGetState
    Object.assign(proxy, originalGetState)

    const tracksModule = await import(`./index?v=${Date.now()}`)

    expect(calls).toEqual([])
    expect(tracksModule.listPresetTracks().length).toBeGreaterThan(0)
  })

  test('listPresetTracks returns sync metadata without building objects', async () => {
    const { listPresetTracks, getPresetTrack } = await import('./index')
    const metas = listPresetTracks()
    expect(metas.length).toBeGreaterThan(0)
    for (const meta of metas) {
      expect(meta.id).toBeTruthy()
      expect(meta.name).toBeTruthy()
      expect(typeof meta.trackLength).toBe('number')
      expect(typeof meta.turns).toBe('number')
      expect('objects' in meta).toBe(false)
    }
    expect(getPresetTrack(metas[0]!.id)).toBeDefined()
  })
})
