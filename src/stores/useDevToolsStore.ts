import { create } from 'zustand'
import type { Position } from '../utils/dragController'

export type DevPanelId = 'physics-debug' | 'weather' | 'track-switcher'

export interface DevPanelState {
  isOpen: boolean
  position: Position
  focusOrder: number
}

interface DevToolsState {
  panels: Record<DevPanelId, DevPanelState>
  togglePanel: (id: DevPanelId) => void
  openPanel: (id: DevPanelId) => void
  closePanel: (id: DevPanelId) => void
  setPanelPosition: (id: DevPanelId, pos: Position) => void
  bringToFront: (id: DevPanelId) => void
  reset: () => void
}

const DEFAULT_POSITIONS: Record<DevPanelId, Position> = {
  'physics-debug': { x: 24, y: 80 },
  weather: { x: 320, y: 80 },
  'track-switcher': { x: 24, y: 380 },
}

function defaultPanels(): Record<DevPanelId, DevPanelState> {
  return {
    'physics-debug': { isOpen: false, position: DEFAULT_POSITIONS['physics-debug'], focusOrder: 0 },
    weather: { isOpen: false, position: DEFAULT_POSITIONS.weather, focusOrder: 0 },
    'track-switcher': {
      isOpen: false,
      position: DEFAULT_POSITIONS['track-switcher'],
      focusOrder: 0,
    },
  }
}

function maxFocusOrder(panels: Record<DevPanelId, DevPanelState>): number {
  let max = 0
  for (const p of Object.values(panels)) {
    if (p.focusOrder > max) max = p.focusOrder
  }
  return max
}

export const useDevToolsStore = create<DevToolsState>(set => ({
  panels: defaultPanels(),
  togglePanel: id =>
    set(state => {
      const wasOpen = state.panels[id].isOpen
      const nextFocus = wasOpen ? state.panels[id].focusOrder : maxFocusOrder(state.panels) + 1
      return {
        panels: {
          ...state.panels,
          [id]: { ...state.panels[id], isOpen: !wasOpen, focusOrder: nextFocus },
        },
      }
    }),
  openPanel: id =>
    set(state => ({
      panels: {
        ...state.panels,
        [id]: {
          ...state.panels[id],
          isOpen: true,
          focusOrder: maxFocusOrder(state.panels) + 1,
        },
      },
    })),
  closePanel: id =>
    set(state => ({
      panels: { ...state.panels, [id]: { ...state.panels[id], isOpen: false } },
    })),
  setPanelPosition: (id, pos) =>
    set(state => ({
      panels: { ...state.panels, [id]: { ...state.panels[id], position: pos } },
    })),
  bringToFront: id =>
    set(state => {
      const top = maxFocusOrder(state.panels)
      if (state.panels[id].focusOrder === top && top > 0) return state
      return {
        panels: { ...state.panels, [id]: { ...state.panels[id], focusOrder: top + 1 } },
      }
    }),
  reset: () => set({ panels: defaultPanels() }),
}))

export const DEV_PANEL_IDS: DevPanelId[] = ['physics-debug', 'weather', 'track-switcher']
