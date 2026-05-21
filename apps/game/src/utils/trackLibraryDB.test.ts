import { describe, it, expect, beforeEach } from 'vitest'
import type { TrackLibrary } from '../types/track'

const HAS_IDB = typeof indexedDB !== 'undefined'
const describeIfIdb = HAS_IDB ? describe : describe.skip

const makeLibrary = (overrides: Partial<TrackLibrary> = {}): TrackLibrary => ({
  version: 1,
  activeTrackId: null,
  tracks: [],
  ...overrides,
})

describeIfIdb('trackLibraryDB', () => {
  beforeEach(async () => {
    const { clearLibrary } = await import('./trackLibraryDB')
    await clearLibrary()
  })

  it('returns null when the store is empty', async () => {
    const { readLibrary } = await import('./trackLibraryDB')
    const result = await readLibrary()
    expect(result.library).toBeNull()
    expect(result.migrationApplied).toBe(false)
  })

  it('round-trips a v2 library through write then read', async () => {
    const { readLibrary, writeLibrary } = await import('./trackLibraryDB')
    const lib = makeLibrary({
      activeTrackId: 't1',
      tracks: [
        {
          id: 't1',
          name: 'Track One',
          createdAt: 1,
          updatedAt: 2,
          objectCount: 0,
          objects: [],
          schemaVersion: 2,
          sidecarApplied: false,
          customBaselineUsed: false,
          deltaPresent: false,
        },
      ],
    })
    await writeLibrary(lib)
    const loaded = await readLibrary()
    expect(loaded.library).toEqual(lib)
    expect(loaded.migrationApplied).toBe(false)
    expect(loaded.isReadOnlyMigrationShim).toBe(false)
  })

  it('overwrite replaces the previous record', async () => {
    const { readLibrary, writeLibrary } = await import('./trackLibraryDB')
    await writeLibrary(makeLibrary({ activeTrackId: 'a' }))
    await writeLibrary(makeLibrary({ activeTrackId: 'b' }))
    const loaded = await readLibrary()
    expect(loaded.library?.activeTrackId).toBe('b')
  })

  it('clearLibrary removes the row', async () => {
    const { readLibrary, writeLibrary, clearLibrary } = await import('./trackLibraryDB')
    await writeLibrary(makeLibrary({ activeTrackId: 'a' }))
    await clearLibrary()
    const result = await readLibrary()
    expect(result.library).toBeNull()
  })

  it('concurrent writes resolve and the last one wins', async () => {
    const { readLibrary, writeLibrary } = await import('./trackLibraryDB')
    await Promise.all([
      writeLibrary(makeLibrary({ activeTrackId: 'first' })),
      writeLibrary(makeLibrary({ activeTrackId: 'second' })),
      writeLibrary(makeLibrary({ activeTrackId: 'third' })),
    ])
    const loaded = await readLibrary()
    expect(loaded.library?.activeTrackId).toBe('third')
  })
})
