import { create } from 'zustand'
import { type GhostReplayData, loadReplay, saveReplay as dbSaveReplay } from '@/utils/ghostReplayDB'

interface GhostCarState {
  replayData: GhostReplayData | null
  isLoaded: boolean
  ghostPosition: [number, number, number] | null
  ghostTimeDelta: number | null

  loadReplayForTrack: (trackId: string) => Promise<void>
  saveReplay: (
    trackId: string,
    lapTime: number,
    data: Omit<GhostReplayData, 'trackId' | 'lapTime'>,
  ) => Promise<void>
  clearReplay: () => void
  setGhostFrameState: (pos: [number, number, number] | null, delta: number | null) => void
}

export const useGhostCarStore = create<GhostCarState>()((set, get) => ({
  replayData: null,
  isLoaded: false,
  ghostPosition: null,
  ghostTimeDelta: null,

  loadReplayForTrack: async (trackId: string) => {
    set({ isLoaded: false, replayData: null })
    try {
      const data = await loadReplay(trackId)
      set({ replayData: data, isLoaded: true })
    } catch {
      set({ isLoaded: true })
    }
  },

  saveReplay: async (trackId, lapTime, data) => {
    const current = get().replayData
    if (current && current.lapTime <= lapTime) return
    set({
      replayData: {
        trackId,
        lapTime,
        ...data,
      },
      isLoaded: true,
    })
    try {
      await dbSaveReplay(trackId, lapTime, data)
    } catch {
      // IndexedDB write failed — ghost data stays in memory only
    }
  },

  clearReplay: () => {
    set({ replayData: null, isLoaded: false, ghostPosition: null, ghostTimeDelta: null })
  },

  setGhostFrameState: (pos, delta) => {
    set({ ghostPosition: pos, ghostTimeDelta: delta })
  },
}))
