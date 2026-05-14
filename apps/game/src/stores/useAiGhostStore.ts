import { create } from 'zustand'
import type { GhostReplayData } from '@/utils/ghostReplayDB'

interface AiGhostState {
  replayData: GhostReplayData | null
  isLoaded: boolean
  ghostPosition: [number, number, number] | null
  ghostTimeDelta: number | null

  setReplay: (data: GhostReplayData) => void
  clearReplay: () => void
  setGhostFrameState: (
    pos: [number, number, number] | null,
    delta: number | null,
  ) => void
}

export const useAiGhostStore = create<AiGhostState>()(set => ({
  replayData: null,
  isLoaded: false,
  ghostPosition: null,
  ghostTimeDelta: null,

  setReplay: data => {
    set({ replayData: data, isLoaded: true, ghostPosition: null, ghostTimeDelta: null })
  },

  clearReplay: () => {
    set({ replayData: null, isLoaded: false, ghostPosition: null, ghostTimeDelta: null })
  },

  setGhostFrameState: (pos, delta) => {
    set({ ghostPosition: pos, ghostTimeDelta: delta })
  },
}))
