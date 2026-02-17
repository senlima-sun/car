const DB_NAME = 'f1-ghost-replays'
const DB_VERSION = 1
const STORE_NAME = 'replays'

export interface GhostReplayData {
  trackId: string
  lapTime: number
  frameCount: number
  positions: Float32Array
  rotations: Float32Array
  steerAngles: Float32Array
  wheelRotations: Float32Array
  timestamps: Float32Array
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trackId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

interface StoredReplay {
  trackId: string
  lapTime: number
  frameCount: number
  positions: ArrayBuffer
  rotations: ArrayBuffer
  steerAngles: ArrayBuffer
  wheelRotations: ArrayBuffer
  timestamps: ArrayBuffer
}

export async function saveReplay(
  trackId: string,
  lapTime: number,
  data: Omit<GhostReplayData, 'trackId' | 'lapTime'>,
): Promise<boolean> {
  const db = await openDB()

  const existing = await new Promise<StoredReplay | undefined>((resolve, reject) => {
    const readTx = db.transaction(STORE_NAME, 'readonly')
    const req = readTx.objectStore(STORE_NAME).get(trackId)
    req.onsuccess = () => resolve(req.result as StoredReplay | undefined)
    req.onerror = () => reject(req.error)
  })

  if (existing && existing.lapTime <= lapTime) {
    db.close()
    return false
  }

  const record: StoredReplay = {
    trackId,
    lapTime,
    frameCount: data.frameCount,
    positions: data.positions.buffer.slice(0, data.frameCount * 3 * 4),
    rotations: data.rotations.buffer.slice(0, data.frameCount * 4 * 4),
    steerAngles: data.steerAngles.buffer.slice(0, data.frameCount * 4),
    wheelRotations: data.wheelRotations.buffer.slice(0, data.frameCount * 4 * 4),
    timestamps: data.timestamps.buffer.slice(0, data.frameCount * 4),
  }

  return new Promise((resolve, reject) => {
    const writeTx = db.transaction(STORE_NAME, 'readwrite')
    const req = writeTx.objectStore(STORE_NAME).put(record)
    req.onsuccess = () => {
      db.close()
      resolve(true)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

export async function loadReplay(trackId: string): Promise<GhostReplayData | null> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const req = store.get(trackId)
    req.onsuccess = () => {
      db.close()
      const record = req.result as StoredReplay | undefined
      if (!record) {
        resolve(null)
        return
      }
      resolve({
        trackId: record.trackId,
        lapTime: record.lapTime,
        frameCount: record.frameCount,
        positions: new Float32Array(record.positions),
        rotations: new Float32Array(record.rotations),
        steerAngles: new Float32Array(record.steerAngles),
        wheelRotations: new Float32Array(record.wheelRotations),
        timestamps: new Float32Array(record.timestamps),
      })
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

export async function deleteReplay(trackId: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const req = store.delete(trackId)
    req.onsuccess = () => {
      db.close()
      resolve()
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}
