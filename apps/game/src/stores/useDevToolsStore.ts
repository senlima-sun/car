import { create } from 'zustand'
import type { Position } from '../utils/dragController'

export type DevPanelId =
  | 'physics-debug'
  | 'steering-debug'
  | 'weather'
  | 'track-switcher'
  | 'minimap'
  | 'car-status'
  | 'track-limit-snapshots'

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
  'steering-debug': { x: 360, y: 80 },
  weather: { x: 320, y: 80 },
  'track-switcher': { x: 24, y: 380 },
  minimap: { x: 24, y: 80 },
  'car-status': { x: 24, y: 0 },
  'track-limit-snapshots': { x: 0, y: 0 },
}

const DEFAULT_OPEN: Record<DevPanelId, boolean> = {
  'physics-debug': false,
  'steering-debug': false,
  weather: false,
  'track-switcher': false,
  minimap: true,
  'car-status': true,
  'track-limit-snapshots': false,
}

function defaultPanels(): Record<DevPanelId, DevPanelState> {
  return {
    'physics-debug': {
      isOpen: DEFAULT_OPEN['physics-debug'],
      position: DEFAULT_POSITIONS['physics-debug'],
      focusOrder: 0,
    },
    'steering-debug': {
      isOpen: DEFAULT_OPEN['steering-debug'],
      position: DEFAULT_POSITIONS['steering-debug'],
      focusOrder: 0,
    },
    weather: { isOpen: DEFAULT_OPEN.weather, position: DEFAULT_POSITIONS.weather, focusOrder: 0 },
    'track-switcher': {
      isOpen: DEFAULT_OPEN['track-switcher'],
      position: DEFAULT_POSITIONS['track-switcher'],
      focusOrder: 0,
    },
    minimap: { isOpen: DEFAULT_OPEN.minimap, position: DEFAULT_POSITIONS.minimap, focusOrder: 0 },
    'car-status': {
      isOpen: DEFAULT_OPEN['car-status'],
      position: DEFAULT_POSITIONS['car-status'],
      focusOrder: 0,
    },
    'track-limit-snapshots': {
      isOpen: DEFAULT_OPEN['track-limit-snapshots'],
      position: DEFAULT_POSITIONS['track-limit-snapshots'],
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

export const DEV_PANEL_IDS: DevPanelId[] = [
  'physics-debug',
  'steering-debug',
  'weather',
  'track-switcher',
  'minimap',
  'car-status',
  'track-limit-snapshots',
]
