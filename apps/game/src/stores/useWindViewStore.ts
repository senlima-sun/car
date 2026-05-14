import { create } from 'zustand'

interface WindViewState {
  isEnabled: boolean
  toggle: () => void
  setEnabled: (enabled: boolean) => void
}

export const useWindViewStore = create<WindViewState>(set => ({
  isEnabled: false,
  toggle: () => set(state => ({ isEnabled: !state.isEnabled })),
  setEnabled: enabled => set({ isEnabled: enabled }),
}))
