import { create } from 'zustand'
import type {
  ElevationDragState,
  ElevationTool,
  SlopeAnchor,
  ElevationControlPoint,
} from '../types/trackObjects'
import { editorCommandStack } from '../utils/commandStack'
import { smoothElevations } from '../utils/elevationHandles'
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
  applySmoothElevation: (roadIds: string[]) => void
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

  applySmoothElevation: roadIds => {
    if (roadIds.length === 0) return

    const customStore = useCustomizationStore.getState()
    const result = smoothElevations(roadIds, customStore.placedObjects, 1)
    if (result.size === 0) return

    const byId = new Map(customStore.placedObjects.map(o => [o.id, o]))
    const before = new Map<string, { startElevation: number; endElevation: number }>()
    for (const [id] of result) {
      const obj = byId.get(id)
      if (obj) {
        before.set(id, {
          startElevation: obj.startElevation ?? 0,
          endElevation: obj.endElevation ?? 0,
        })
      }
    }

    const resultCopy = new Map(result)
    const beforeCopy = new Map(before)

    const command: EditorCommand = {
      execute: () => {
        const store = useCustomizationStore.getState()
        for (const [id, vals] of resultCopy) {
          store.updateObject(id, vals)
        }
      },
      undo: () => {
        const store = useCustomizationStore.getState()
        for (const [id, vals] of beforeCopy) {
          store.updateObject(id, vals)
        }
      },
      description: 'Smooth elevations',
    }
    editorCommandStack.push(command)

    get().clearSmoothSelection()
  },
}))
