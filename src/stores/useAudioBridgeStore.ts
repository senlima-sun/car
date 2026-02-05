import { create } from 'zustand'
import type { FrameAudioParams } from '@/audio/types'

interface AudioBridgeState {
  updateFrame: ((params: FrameAudioParams) => void) | null
  setUpdateFrame: (fn: (params: FrameAudioParams) => void) => void
}

export const useAudioBridgeStore = create<AudioBridgeState>(set => ({
  updateFrame: null,
  setUpdateFrame: fn => set({ updateFrame: fn }),
}))
