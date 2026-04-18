import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETUP, type CarSetup } from '@/types/setup'

interface SetupState {
  /** Last applied setup (null = defaults). */
  current: CarSetup
  /** Per-track setup library keyed by trackId. */
  perTrack: Record<string, CarSetup>

  setSetup: (patch: Partial<CarSetup>) => void
  saveForTrack: (trackId: string) => void
  loadForTrack: (trackId: string) => void
  resetSetup: () => void
}

export const useSetupStore = create<SetupState>()(
  persist(
    (set, get) => ({
      current: DEFAULT_SETUP,
      perTrack: {},

      setSetup: patch => set({ current: { ...get().current, ...patch } }),

      saveForTrack: trackId => {
        const { current, perTrack } = get()
        set({ perTrack: { ...perTrack, [trackId]: current } })
      },

      loadForTrack: trackId => {
        const stored = get().perTrack[trackId]
        if (stored) set({ current: stored })
      },

      resetSetup: () => set({ current: DEFAULT_SETUP }),
    }),
    { name: 'setup-store' },
  ),
)
