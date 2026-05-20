import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import type { TrackLibrary, SavedTrack } from '../types/track'

const DB_NAME = 'f1-track-library'

async function clearAllDB(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

function v1SavedTrack(overrides: Partial<SavedTrack> = {}): SavedTrack {
  return {
    id: 't1',
    name: 'Spa',
    createdAt: 1,
    updatedAt: 2,
    objectCount: 1,
    objects: [
      {
        id: 'r1',
        type: 'track_ribbon',
        position: [0, 0, 0],
        rotation: 0,
        ribbonPoints: [
          { x: 0, y: 42, z: 0, isPitLane: false },
          { x: 10, y: 50, z: 5, isPitLane: false },
        ],
      },
    ],
    presetId: 'f1_spa',
    heightmap: [10, 20, 30],
    heightmapSource: 'sidecar',
    ...overrides,
  }
}

function v1Library(): TrackLibrary {
  return {
    version: 1,
    activeTrackId: 't1',
    tracks: [v1SavedTrack()],
  }
}

async function seedV1Library(lib: TrackLibrary): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains('library')) {
        d.createObjectStore('library', { keyPath: 'storageKey' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('library', 'readwrite')
    tx.objectStore('library').put({ storageKey: 'library', library: lib })
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function rawReadKey(key: string): Promise<unknown | null> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', 'readonly')
    const req = tx.objectStore('library').get(key)
    req.onsuccess = () => {
      db.close()
      resolve(req.result ?? null)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

beforeEach(async () => {
  ;(globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory()
  await clearAllDB()
})

afterEach(async () => {
  await clearAllDB()
})

describe('readLibrary v1→v2 migration', () => {
  test('migrates a v1 library, writes backup, returns v2', async () => {
    await seedV1Library(v1Library())
    const { readLibrary } = await import('./trackLibraryDB')

    const result = await readLibrary()

    expect(result.migrationApplied).toBe(true)
    expect(result.isReadOnlyMigrationShim).toBe(false)
    expect(result.library).not.toBeNull()
    const track = result.library!.tracks[0]!
    expect(track.schemaVersion).toBe(2)
    expect(track.sidecarApplied).toBe(true)
    expect(track.heightmapSidecarRef).toBe('f1_spa')
    expect(track.objects[0]!.ribbonPoints![0]!.y).toBe(0)

    const backup = (await rawReadKey('library-v1-backup')) as
      | { library: TrackLibrary }
      | null
    expect(backup).not.toBeNull()
    expect(backup!.library.tracks[0]!.heightmapSource).toBe('sidecar')
    expect(backup!.library.tracks[0]!.objects[0]!.ribbonPoints![0]!.y).toBe(42)
  })

  test('idempotent: re-reading after migration does not re-run it', async () => {
    await seedV1Library(v1Library())
    const { readLibrary } = await import('./trackLibraryDB')
    const first = await readLibrary()
    expect(first.migrationApplied).toBe(true)

    const second = await readLibrary()
    expect(second.migrationApplied).toBe(false)
    expect(second.library!.tracks[0]!.schemaVersion).toBe(2)
  })

  test('backup is not overwritten on subsequent reads', async () => {
    await seedV1Library(v1Library())
    const { readLibrary } = await import('./trackLibraryDB')

    await readLibrary()
    const firstBackup = (await rawReadKey('library-v1-backup')) as {
      library: TrackLibrary
    }

    await readLibrary()
    const secondBackup = (await rawReadKey('library-v1-backup')) as {
      library: TrackLibrary
    }

    expect(secondBackup).toEqual(firstBackup)
  })

  test('returns null when no library is stored', async () => {
    const { readLibrary } = await import('./trackLibraryDB')
    const result = await readLibrary()
    expect(result.library).toBeNull()
    expect(result.migrationApplied).toBe(false)
  })

  test('v2 library is passed through untouched (no migration)', async () => {
    const v2Lib: TrackLibrary = {
      version: 2,
      activeTrackId: 't1',
      tracks: [
        {
          id: 't1',
          name: 'Spa',
          createdAt: 1,
          updatedAt: 2,
          objectCount: 0,
          objects: [],
          schemaVersion: 2,
          sidecarApplied: true,
          customBaselineUsed: false,
          deltaPresent: false,
        },
      ],
    }
    await seedV1Library(v2Lib)
    const { readLibrary } = await import('./trackLibraryDB')
    const result = await readLibrary()
    expect(result.migrationApplied).toBe(false)
    expect(result.library).toEqual(v2Lib)
  })
})

describe('readLibrary atomicity under put failure', () => {
  test('when normalize-write fails, neither backup nor v2 is committed', async () => {
    await seedV1Library(v1Library())

    const originalPut = IDBObjectStore.prototype.put
    let putCount = 0
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value, key) {
      putCount++
      if (putCount === 2) {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError')
      }
      return originalPut.call(this, value, key) as IDBRequest
    } as typeof IDBObjectStore.prototype.put

    try {
      const { readLibrary } = await import('./trackLibraryDB')
      const result = await readLibrary()

      expect(result.isReadOnlyMigrationShim).toBe(true)
      expect(result.migrationApplied).toBe(false)
      expect(result.library).not.toBeNull()

      const liveAfter = (await rawReadKey('library')) as {
        library: TrackLibrary
      }
      expect(liveAfter.library.tracks[0]!.schemaVersion).toBeUndefined()
      const backupAfter = await rawReadKey('library-v1-backup')
      expect(backupAfter).toBeNull()
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }
  })
})
