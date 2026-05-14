import { create } from 'zustand'

interface GhostPreferenceState {
  preferAiGhost: boolean
  setPreferAiGhost: (value: boolean) => void
  toggle: () => void
}

export const useGhostPreferenceStore = create<GhostPreferenceState>()(set => ({
  preferAiGhost: false,
  setPreferAiGhost: value => set({ preferAiGhost: value }),
  toggle: () => set(state => ({ preferAiGhost: !state.preferAiGhost })),
}))
