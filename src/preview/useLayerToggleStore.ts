import { create } from 'zustand'
import type { LayerGroup } from '../types/trackObjects'

interface LayerToggleState {
  visible: Record<LayerGroup, boolean>
  toggle: (group: LayerGroup) => void
}

const DEFAULT_VISIBILITY = {
  surface: true,
  edge: true,
  painted: true,
  curb: true,
  pit: true,
} satisfies Record<LayerGroup, boolean>

export const useLayerToggleStore = create<LayerToggleState>(set => ({
  visible: { ...DEFAULT_VISIBILITY },
  toggle: group =>
    set(state => ({
      visible: { ...state.visible, [group]: !state.visible[group] },
    })),
}))
