const DB_NAME = 'f1-telemetry'
const DB_VERSION = 2
const STORE_NAME = 'laps'
const MAX_LAPS_PER_TRACK = 20

export interface StoredTelemetryLap {
  id?: number
  trackId: string
  lapTime: number
  frameCount: number
  data: ArrayBuffer
  timestamp: number
  metadata?: Record<string, unknown>
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = event => {
      const db = req.result
      if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('trackId', 'trackId', { unique: false })
        store.createIndex('trackId_timestamp', ['trackId', 'timestamp'], {
          unique: false,
        })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveTelemetryLap(lap: Omit<StoredTelemetryLap, 'id'>): Promise<number> {
  const db = await openDB()

  const trackLaps = await getLapsByTrack(lap.trackId)
  if (trackLaps.length >= MAX_LAPS_PER_TRACK) {
    trackLaps.sort((a, b) => a.lapTime - b.lapTime)
    const toRemove = trackLaps.slice(MAX_LAPS_PER_TRACK - 1)
    for (const old of toRemove) {
      if (old.id != null) await deleteTelemetryLap(old.id)
    }
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.add(lap)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function getLapsByTrack(trackId: string): Promise<StoredTelemetryLap[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('trackId')
    const req = index.getAll(trackId)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getTelemetryLap(id: number): Promise<StoredTelemetryLap | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteTelemetryLap(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function getAllLaps(): Promise<StoredTelemetryLap[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function clearAllLaps(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
