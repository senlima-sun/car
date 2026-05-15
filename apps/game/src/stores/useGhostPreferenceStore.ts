import { create } from 'zustand'

interface GhostPreferenceState {
  preferAiGhost: boolean
  spectatorMode: boolean
  spectatorLapStart: number | null
  setPreferAiGhost: (value: boolean) => void
  toggle: () => void
  setSpectatorMode: (value: boolean) => void
  setSpectatorLapStart: (timestamp: number | null) => void
}

export const useGhostPreferenceStore = create<GhostPreferenceState>()(set => ({
  preferAiGhost: false,
  spectatorMode: false,
  spectatorLapStart: null,
  setPreferAiGhost: value => set({ preferAiGhost: value }),
  toggle: () => set(state => ({ preferAiGhost: !state.preferAiGhost })),
  setSpectatorMode: value =>
    set(state => ({
      spectatorMode: value,
      spectatorLapStart: value
        ? (state.spectatorLapStart ?? performance.now())
        : null,
      preferAiGhost: value ? true : state.preferAiGhost,
    })),
  setSpectatorLapStart: timestamp => set({ spectatorLapStart: timestamp }),
}))
