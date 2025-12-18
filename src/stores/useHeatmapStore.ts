import { create } from 'zustand'

interface HeatmapState {
  isVisible: boolean
  toggleHeatmap: () => void
  setVisible: (visible: boolean) => void
}

export const useHeatmapStore = create<HeatmapState>((set) => ({
  isVisible: false,
  toggleHeatmap: () => set((state) => ({ isVisible: !state.isVisible })),
  setVisible: (visible) => set({ isVisible: visible }),
}))
