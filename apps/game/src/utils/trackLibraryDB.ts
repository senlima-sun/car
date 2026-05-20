import type { TrackLibrary } from '../types/track'
import { migrateSavedTrackV1ToV2 } from '../types/track'

const DB_NAME = 'f1-track-library'
const DB_VERSION = 1
const STORE_NAME = 'library'
const RECORD_KEY = 'library'
const BACKUP_KEY = 'library-v1-backup'

interface StoredLibrary {
  storageKey: string
  library: TrackLibrary
}

export interface ReadLibraryResult {
  library: TrackLibrary | null
  migrationApplied: boolean
  isReadOnlyMigrationShim: boolean
  migrationError?: string
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IDB transaction error'))
    tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'))
  })
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'storageKey' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function libraryNeedsMigration(library: TrackLibrary): boolean {
  return library.tracks.some(t => t.schemaVersion === undefined)
}

function migrateLibrary(library: TrackLibrary): TrackLibrary {
  return {
    ...library,
    tracks: library.tracks.map(migrateSavedTrackV1ToV2),
  }
}

export async function readLibrary(): Promise<ReadLibraryResult> {
  const db = await openDB()
  try {
    const readTx = db.transaction(STORE_NAME, 'readonly')
    const store = readTx.objectStore(STORE_NAME)
    const [liveRecord, backupRecord] = await Promise.all([
      promisify(store.get(RECORD_KEY)) as Promise<StoredLibrary | undefined>,
      promisify(store.get(BACKUP_KEY)) as Promise<StoredLibrary | undefined>,
    ])
    await txComplete(readTx)

    const liveLibrary = liveRecord?.library ?? null
    if (!liveLibrary || !libraryNeedsMigration(liveLibrary)) {
      return {
        library: liveLibrary,
        migrationApplied: false,
        isReadOnlyMigrationShim: false,
      }
    }

    const migrated = migrateLibrary(liveLibrary)
    const backupNeeded = !backupRecord
    const backupRecordToWrite: StoredLibrary | null = backupNeeded
      ? { storageKey: BACKUP_KEY, library: liveLibrary }
      : null

    try {
      const writeTx = db.transaction(STORE_NAME, 'readwrite')
      const writeStore = writeTx.objectStore(STORE_NAME)
      const requests: IDBRequest[] = []
      try {
        if (backupRecordToWrite) {
          requests.push(writeStore.put(backupRecordToWrite))
        }
        requests.push(
          writeStore.put({ storageKey: RECORD_KEY, library: migrated } as StoredLibrary),
        )
      } catch (queueErr) {
        for (const req of requests) {
          req.onerror = () => {}
          req.onsuccess = () => {}
        }
        try {
          writeTx.abort()
        } catch {
          // tx may already be aborted; ignore
        }
        try {
          await txComplete(writeTx)
        } catch {
          // abort surfaces here; that is the intended outcome
        }
        return {
          library: liveLibrary,
          migrationApplied: false,
          isReadOnlyMigrationShim: true,
          migrationError: (queueErr as Error).message,
        }
      }

      await Promise.all(requests.map(promisify))
      await txComplete(writeTx)

      return {
        library: migrated,
        migrationApplied: true,
        isReadOnlyMigrationShim: false,
      }
    } catch (err) {
      return {
        library: liveLibrary,
        migrationApplied: false,
        isReadOnlyMigrationShim: true,
        migrationError: (err as Error).message,
      }
    }
  } finally {
    db.close()
  }
}

export async function writeLibrary(library: TrackLibrary): Promise<void> {
  const db = await openDB()
  const record: StoredLibrary = { storageKey: RECORD_KEY, library }
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await promisify(tx.objectStore(STORE_NAME).put(record))
    await txComplete(tx)
  } finally {
    db.close()
  }
}

export async function clearLibrary(): Promise<void> {
  const db = await openDB()
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await promisify(tx.objectStore(STORE_NAME).delete(RECORD_KEY))
    await txComplete(tx)
  } finally {
    db.close()
  }
}

export async function readV1Backup(): Promise<TrackLibrary | null> {
  const db = await openDB()
  try {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const record = (await promisify(tx.objectStore(STORE_NAME).get(BACKUP_KEY))) as
      | StoredLibrary
      | undefined
    await txComplete(tx)
    return record?.library ?? null
  } finally {
    db.close()
  }
}
