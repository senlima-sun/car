import { create } from 'zustand'
import type {
  ElevationDragState,
  ElevationTool,
  SlopeAnchor,
  ElevationControlPoint,
} from '../types/trackObjects'
import { editorCommandStack } from '../utils/commandStack'
import type { EditorCommand } from '../types/editor'
import { useCustomizationStore } from './useCustomizationStore'

interface ElevationEditState {
  elevationTool: ElevationTool
  elevationDragState: ElevationDragState | null
  targetLevelHeight: number
  slopeAnchor: SlopeAnchor | null
  smoothSelectedRoadIds: string[]
  propagateToNeighbors: boolean

  setElevationTool: (tool: ElevationTool) => void
  startElevationDrag: (
    roadId: string,
    endpoint: 'start' | 'end',
    currentHeight: number,
    screenY: number,
    connectedEndpoints: ElevationControlPoint[],
  ) => void
  updateElevationDrag: (screenY: number) => void
  confirmElevationDrag: () => void
  cancelElevationDrag: () => void
  setTargetLevelHeight: (h: number) => void
  setSlopeAnchor: (anchor: SlopeAnchor | null) => void
  toggleSmoothRoadSelection: (roadId: string) => void
  clearSmoothSelection: () => void
  setPropagateToNeighbors: (enabled: boolean) => void
}

export const useElevationEditStore = create<ElevationEditState>((set, get) => ({
  elevationTool: 'raise' as ElevationTool,
  elevationDragState: null,
  targetLevelHeight: 0,
  slopeAnchor: null,
  smoothSelectedRoadIds: [],
  propagateToNeighbors: false,

  setElevationTool: tool =>
    set({
      elevationTool: tool,
      elevationDragState: null,
      slopeAnchor: null,
      smoothSelectedRoadIds: [],
    }),

  startElevationDrag: (roadId, endpoint, currentHeight, screenY, connectedEndpoints) =>
    set({
      elevationDragState: {
        roadId,
        endpoint,
        initialHeight: currentHeight,
        currentHeight,
        screenStartY: screenY,
        connectedEndpoints,
      },
    }),

  updateElevationDrag: screenY => {
    const state = get()
    if (!state.elevationDragState) return
    const deltaHeight = (state.elevationDragState.screenStartY - screenY) * 0.05
    const rawHeight = state.elevationDragState.initialHeight + deltaHeight
    const snapped = Math.round(rawHeight / 0.25) * 0.25
    const clamped = Math.max(0, Math.min(20, snapped))
    set({
      elevationDragState: {
        ...state.elevationDragState,
        currentHeight: clamped,
      },
    })
  },

  confirmElevationDrag: () => {
    const state = get()
    if (!state.elevationDragState) return
    const { roadId, endpoint, initialHeight, currentHeight, connectedEndpoints } =
      state.elevationDragState
    if (initialHeight === currentHeight) {
      set({ elevationDragState: null })
      return
    }

    const elevProp = endpoint === 'start' ? 'startElevation' : 'endElevation'

    const allUpdates: { id: string; prop: string; before: number; after: number }[] = []
    allUpdates.push({ id: roadId, prop: elevProp, before: initialHeight, after: currentHeight })

    for (const cp of connectedEndpoints) {
      if (cp.roadId === roadId && cp.endpoint === endpoint) continue
      const cpProp = cp.endpoint === 'start' ? 'startElevation' : 'endElevation'
      allUpdates.push({ id: cp.roadId, prop: cpProp, before: cp.elevation, after: currentHeight })
    }

    const command: EditorCommand = {
      execute: () => {
        const store = useCustomizationStore.getState()
        for (const u of allUpdates) {
          store.updateObject(u.id, { [u.prop]: u.after })
        }
      },
      undo: () => {
        const store = useCustomizationStore.getState()
        for (const u of allUpdates) {
          store.updateObject(u.id, { [u.prop]: u.before })
        }
      },
      description: `Adjust elevation`,
    }
    editorCommandStack.push(command)

    set({ elevationDragState: null })
  },

  cancelElevationDrag: () => {
    const state = get()
    if (!state.elevationDragState) return
    const { roadId, endpoint, initialHeight, connectedEndpoints } = state.elevationDragState
    const customStore = useCustomizationStore.getState()
    const elevProp = endpoint === 'start' ? 'startElevation' : 'endElevation'
    customStore.updateObject(roadId, { [elevProp]: initialHeight })
    for (const cp of connectedEndpoints) {
      if (cp.roadId === roadId && cp.endpoint === endpoint) continue
      const cpProp = cp.endpoint === 'start' ? 'startElevation' : 'endElevation'
      customStore.updateObject(cp.roadId, { [cpProp]: cp.elevation })
    }
    set({ elevationDragState: null })
  },

  setTargetLevelHeight: h => set({ targetLevelHeight: h }),

  setSlopeAnchor: anchor => set({ slopeAnchor: anchor }),

  toggleSmoothRoadSelection: roadId =>
    set(state => ({
      smoothSelectedRoadIds: state.smoothSelectedRoadIds.includes(roadId)
        ? state.smoothSelectedRoadIds.filter(id => id !== roadId)
        : [...state.smoothSelectedRoadIds, roadId],
    })),

  clearSmoothSelection: () => set({ smoothSelectedRoadIds: [] }),

  setPropagateToNeighbors: enabled => set({ propagateToNeighbors: enabled }),
}))
