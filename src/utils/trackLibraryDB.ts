import type { TrackLibrary } from '../types/track'

const DB_NAME = 'f1-track-library'
const DB_VERSION = 1
const STORE_NAME = 'library'
const RECORD_KEY = 'library'

interface StoredLibrary {
  storageKey: string
  library: TrackLibrary
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

export async function readLibrary(): Promise<TrackLibrary | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY)
    req.onsuccess = () => {
      db.close()
      const record = req.result as StoredLibrary | undefined
      resolve(record ? record.library : null)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error('IDB transaction aborted'))
    }
  })
}

export async function writeLibrary(library: TrackLibrary): Promise<void> {
  const db = await openDB()
  const record: StoredLibrary = { storageKey: RECORD_KEY, library }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(record)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error('IDB transaction aborted'))
    }
  })
}

export async function clearLibrary(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(RECORD_KEY)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error('IDB transaction aborted'))
    }
  })
}
