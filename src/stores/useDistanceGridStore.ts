import { create } from 'zustand'

interface DistanceGridState {
  isVisible: boolean
  toggleGrid: () => void
  setVisible: (visible: boolean) => void
}

export const useDistanceGridStore = create<DistanceGridState>(set => ({
  isVisible: true, // Default visible for testing
  toggleGrid: () => set(state => ({ isVisible: !state.isVisible })),
  setVisible: visible => set({ isVisible: visible }),
}))
