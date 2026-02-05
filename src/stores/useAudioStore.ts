import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SoundCategory } from '@/audio/types'

interface AudioState {
  master: number
  engine: number
  effects: number
  ui: number
  music: number
  muted: boolean
  initialized: boolean

  setVolume: (category: SoundCategory | 'master', value: number) => void
  toggleMute: () => void
  setInitialized: () => void
}

export const useAudioStore = create<AudioState>()(
  persist(
    set => ({
      master: 0.8,
      engine: 0.7,
      effects: 0.7,
      ui: 0.5,
      music: 0.3,
      muted: false,
      initialized: false,

      setVolume: (category, value) => {
        const clamped = Math.max(0, Math.min(1, value))
        set({ [category]: clamped })
      },

      toggleMute: () => set(state => ({ muted: !state.muted })),

      setInitialized: () => set({ initialized: true }),
    }),
    {
      name: 'audio-settings',
      partialize: state => ({
        master: state.master,
        engine: state.engine,
        effects: state.effects,
        ui: state.ui,
        music: state.music,
        muted: state.muted,
      }),
    }
  )
)
