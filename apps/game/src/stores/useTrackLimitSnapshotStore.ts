import { create } from 'zustand'

/**
 * In-memory ring buffer of recent off-track snapshot PNGs (as data URLs).
 * Lives only for the session — never persisted. Pushing past `MAX` drops
 * the oldest. The HUD subscribes and renders the list as thumbnails.
 */

const MAX = 5

export interface SnapshotEntry {
  /** Monotonic id for React keys. */
  id: number
  /** Data URL of the rendered PNG. */
  dataUrl: string
  /** When the off-track event fired (epoch ms). */
  timestampMs: number
}

interface State {
  snapshots: SnapshotEntry[]
  pushSnapshot: (dataUrl: string) => void
  removeSnapshot: (id: number) => void
  clear: () => void
}

let nextId = 1

export const useTrackLimitSnapshotStore = create<State>(set => ({
  snapshots: [],
  pushSnapshot: dataUrl =>
    set(state => {
      const next: SnapshotEntry = {
        id: nextId++,
        dataUrl,
        timestampMs: Date.now(),
      }
      const trimmed = [next, ...state.snapshots].slice(0, MAX)
      return { snapshots: trimmed }
    }),
  removeSnapshot: id =>
    set(state => ({ snapshots: state.snapshots.filter(s => s.id !== id) })),
  clear: () => set({ snapshots: [] }),
}))
