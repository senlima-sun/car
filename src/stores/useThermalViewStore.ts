import { create } from 'zustand'

interface ThermalViewState {
  isEnabled: boolean
  toggle: () => void
  setEnabled: (enabled: boolean) => void
}

export const useThermalViewStore = create<ThermalViewState>(set => ({
  isEnabled: false,
  toggle: () => set(state => ({ isEnabled: !state.isEnabled })),
  setEnabled: enabled => set({ isEnabled: enabled }),
}))
