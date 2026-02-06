import { create } from 'zustand'
import { type ObjectType, type TrackMode, type PlacementState, type CurbDragState, type PartialDeleteState, type PlacedObject, type CheckpointType, isLinearObject } from '../types/trackObjects'
import type { EditorCommand } from '../types/editor'
import { SnapSettings, DEFAULT_SNAP_SETTINGS } from '../utils/roadSnapping'
import { splitRoadAtSegment } from '../utils/roadGeometry'
import { editorCommandStack } from '../utils/commandStack'
import { useCustomizationStore } from './useCustomizationStore'

export type { SnapSettings }

const ROTATION_STEP = Math.PI / 8

const generateId = (): string => {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

interface EditorState {
  placementState: PlacementState
  selectedObjectType: ObjectType | null
  trackMode: TrackMode
  previewPosition: [number, number, number] | null
  previewRotation: number
  dragStartPoint: [number, number, number] | null
  controlPoint: [number, number, number] | null
  selectedObjectId: string | null
  deleteMode: boolean
  startSnapEdges: { left: [number, number, number]; right: [number, number, number] } | null
  endSnapEdges: { left: [number, number, number]; right: [number, number, number] } | null
  curbDragState: CurbDragState | null
  curbPreviewEndT: number | null
  curbPreviewEndPosition: [number, number, number] | null
  partialDeleteMode: boolean
  partialDeleteState: PartialDeleteState | null
  partialDeletePreviewT: number | null
  partialDeletePreviewPosition: [number, number, number] | null
  autoCurbMode: boolean
  selectedRoadIds: string[]
  snapSettings: SnapSettings
  connectedTangent: [number, number, number] | null
  snappedAngle: number | null
  checkpointPlacementType: CheckpointType
  canUndo: boolean
  canRedo: boolean
  undoDescription: string | null
  redoDescription: string | null
  multiSelectedIds: string[]
  clipboard: PlacedObject[]

  undo: () => void
  redo: () => void
  toggleMultiSelect: (id: string) => void
  clearMultiSelection: () => void
  deleteMultiSelected: () => void
  copySelected: () => void
  pasteAtPosition: (pos: [number, number, number]) => void
  selectObjectType: (type: ObjectType | null) => void
  setTrackMode: (mode: TrackMode) => void
  setDeleteMode: (enabled: boolean) => void
  setPreviewPosition: (pos: [number, number, number] | null) => void
  setPreviewRotation: (rot: number) => void
  rotatePreviewCW: () => void
  rotatePreviewCCW: () => void
  startDrag: (
    startPoint: [number, number, number],
    snapEdges?: { left: [number, number, number]; right: [number, number, number] },
  ) => void
  setControlPoint: (point: [number, number, number]) => void
  setEndSnapEdges: (
    edges: { left: [number, number, number]; right: [number, number, number] } | null,
  ) => void
  confirmPlacement: () => void
  confirmCheckpointPlacement: (
    startPoint: [number, number, number],
    endPoint: [number, number, number],
  ) => void
  setCheckpointPlacementType: (type: CheckpointType) => void
  cancelPlacement: () => void
  selectObject: (id: string | null) => void
  startCurbDrag: (
    roadId: string,
    road: PlacedObject,
    edge: 'left' | 'right',
    t: number,
    position: [number, number, number],
  ) => void
  updateCurbDrag: (t: number, position: [number, number, number]) => void
  confirmCurbPlacement: () => void
  cancelCurbPlacement: () => void
  setPartialDeleteMode: (enabled: boolean) => void
  startPartialDelete: (
    roadId: string,
    road: PlacedObject,
    t: number,
    position: [number, number, number],
  ) => void
  updatePartialDeletePreview: (t: number, position: [number, number, number]) => void
  confirmPartialDelete: () => void
  cancelPartialDelete: () => void
  setAutoCurbMode: (enabled: boolean) => void
  toggleRoadSelection: (roadId: string) => void
  clearRoadSelection: () => void
  setSnapSettings: (settings: Partial<SnapSettings>) => void
  setConnectedTangent: (tangent: [number, number, number] | null) => void
  setSnappedAngle: (angle: number | null) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  placementState: 'idle',
  selectedObjectType: null,
  trackMode: 'straight',
  previewPosition: null,
  previewRotation: 0,
  dragStartPoint: null,
  controlPoint: null,
  selectedObjectId: null,
  deleteMode: false,
  startSnapEdges: null,
  endSnapEdges: null,
  curbDragState: null,
  curbPreviewEndT: null,
  curbPreviewEndPosition: null,
  partialDeleteMode: false,
  partialDeleteState: null,
  partialDeletePreviewT: null,
  partialDeletePreviewPosition: null,
  autoCurbMode: false,
  selectedRoadIds: [],
  snapSettings: DEFAULT_SNAP_SETTINGS,
  connectedTangent: null,
  snappedAngle: null,
  checkpointPlacementType: 'start-finish' as CheckpointType,
  canUndo: false,
  canRedo: false,
  undoDescription: null,
  redoDescription: null,
  multiSelectedIds: [],
  clipboard: [],

  undo: () => {
    editorCommandStack.undo()
  },

  redo: () => {
    editorCommandStack.redo()
  },

  selectObjectType: type => {
    if (type === null) {
      set({
        selectedObjectType: null,
        placementState: 'idle',
        previewPosition: null,
        dragStartPoint: null,
        controlPoint: null,
        startSnapEdges: null,
        endSnapEdges: null,
        connectedTangent: null,
        snappedAngle: null,
      })
    } else {
      set({
        selectedObjectType: type,
        placementState: 'selecting',
        previewRotation: 0,
        dragStartPoint: null,
        controlPoint: null,
        selectedObjectId: null,
        startSnapEdges: null,
        endSnapEdges: null,
        connectedTangent: null,
        snappedAngle: null,
      })
    }
  },

  setTrackMode: mode =>
    set({
      trackMode: mode,
      placementState: get().selectedObjectType ? 'selecting' : 'idle',
      dragStartPoint: null,
      controlPoint: null,
      startSnapEdges: null,
      endSnapEdges: null,
      connectedTangent: null,
      snappedAngle: null,
    }),

  setDeleteMode: enabled =>
    set({
      deleteMode: enabled,
      selectedObjectId: enabled ? get().selectedObjectId : null,
    }),

  setPreviewPosition: pos => set({ previewPosition: pos }),

  setPreviewRotation: rot => set({ previewRotation: rot }),

  rotatePreviewCW: () =>
    set(state => ({
      previewRotation: state.previewRotation + ROTATION_STEP,
    })),

  rotatePreviewCCW: () =>
    set(state => ({
      previewRotation: state.previewRotation - ROTATION_STEP,
    })),

  startDrag: (startPoint, snapEdges) =>
    set({
      dragStartPoint: startPoint,
      placementState: 'dragging',
      startSnapEdges: snapEdges || null,
    }),

  setControlPoint: point =>
    set({
      controlPoint: point,
      placementState: 'placingControlPoint',
    }),

  setEndSnapEdges: edges =>
    set({
      endSnapEdges: edges,
    }),

  confirmPlacement: () => {
    const state = get()
    const {
      selectedObjectType,
      previewPosition,
      previewRotation,
      dragStartPoint,
      controlPoint,
      trackMode,
      startSnapEdges,
      endSnapEdges,
    } = state

    if (!selectedObjectType || !previewPosition) return

    const newObject: PlacedObject = {
      id: generateId(),
      type: selectedObjectType,
      position: previewPosition,
      rotation: previewRotation,
    }

    if (isLinearObject(selectedObjectType) && dragStartPoint) {
      newObject.startPoint = dragStartPoint
      newObject.endPoint = previewPosition
      newObject.trackMode = trackMode

      if (trackMode === 'curve' && controlPoint) {
        newObject.controlPoint = controlPoint
        if (startSnapEdges) {
          newObject.startLeftEdge = startSnapEdges.left
          newObject.startRightEdge = startSnapEdges.right
        }
        if (endSnapEdges) {
          newObject.endLeftEdge = endSnapEdges.left
          newObject.endRightEdge = endSnapEdges.right
        }
        newObject.position = [
          (dragStartPoint[0] + previewPosition[0]) / 2,
          0,
          (dragStartPoint[2] + previewPosition[2]) / 2,
        ]
      } else {
        newObject.position = [
          (dragStartPoint[0] + previewPosition[0]) / 2,
          0,
          (dragStartPoint[2] + previewPosition[2]) / 2,
        ]
        const dx = previewPosition[0] - dragStartPoint[0]
        const dz = previewPosition[2] - dragStartPoint[2]
        newObject.rotation = Math.atan2(dx, dz)
      }
    }

    const command: EditorCommand = {
      execute: () => useCustomizationStore.getState().addObject(newObject),
      undo: () => useCustomizationStore.getState().removeObject(newObject.id),
      description: `Place ${newObject.type}`,
    }
    editorCommandStack.push(command)

    set({
      placementState: 'selecting',
      dragStartPoint: null,
      controlPoint: null,
      startSnapEdges: null,
      endSnapEdges: null,
      connectedTangent: null,
      snappedAngle: null,
    })
  },

  confirmCheckpointPlacement: (startPoint, endPoint) => {
    const state = get()
    const customStore = useCustomizationStore.getState()
    const cpType = state.checkpointPlacementType

    const sectorCheckpoints = customStore.placedObjects.filter(
      o => o.type === 'checkpoint' && o.checkpointType === 'sector',
    )
    const nextOrder = cpType === 'sector' ? sectorCheckpoints.length + 1 : 0

    const newObject: PlacedObject = {
      id: generateId(),
      type: 'checkpoint',
      position: [(startPoint[0] + endPoint[0]) / 2, 0, (startPoint[2] + endPoint[2]) / 2],
      rotation: Math.atan2(endPoint[0] - startPoint[0], endPoint[2] - startPoint[2]),
      startPoint,
      endPoint,
      checkpointType: cpType,
      checkpointOrder: nextOrder,
    }

    if (cpType === 'start-finish') {
      const previousStartFinish = customStore.placedObjects.find(
        o => o.type === 'checkpoint' && (o.checkpointType ?? 'start-finish') === 'start-finish',
      ) || null

      const command: EditorCommand = {
        execute: () => useCustomizationStore.getState().replaceCheckpoint(newObject),
        undo: () => {
          useCustomizationStore.getState().removeObject(newObject.id)
          if (previousStartFinish) {
            useCustomizationStore.getState().addObject(previousStartFinish)
          }
        },
        description: 'Place start-finish',
      }
      editorCommandStack.push(command)
    } else {
      const command: EditorCommand = {
        execute: () => useCustomizationStore.getState().addObject(newObject),
        undo: () => useCustomizationStore.getState().removeObject(newObject.id),
        description: `Place sector ${nextOrder}`,
      }
      editorCommandStack.push(command)
    }

    set({
      placementState: 'selecting',
    })
  },

  setCheckpointPlacementType: (type) => {
    set({ checkpointPlacementType: type })
  },

  cancelPlacement: () =>
    set({
      placementState: get().selectedObjectType ? 'selecting' : 'idle',
      dragStartPoint: null,
      controlPoint: null,
      previewPosition: null,
      startSnapEdges: null,
      endSnapEdges: null,
      connectedTangent: null,
      snappedAngle: null,
    }),

  selectObject: id =>
    set({
      selectedObjectId: id,
      selectedObjectType: null,
      placementState: 'idle',
    }),

  startCurbDrag: (roadId, road, edge, t, position) =>
    set({
      curbDragState: { roadId, road, edge, startT: t, startPosition: position },
      curbPreviewEndT: t,
      curbPreviewEndPosition: position,
      placementState: 'curbDragging',
    }),

  updateCurbDrag: (t, position) =>
    set({
      curbPreviewEndT: t,
      curbPreviewEndPosition: position,
    }),

  confirmCurbPlacement: () => {
    const state = get()
    const { curbDragState, curbPreviewEndT } = state

    if (!curbDragState || curbPreviewEndT === null) return

    const startT = Math.min(curbDragState.startT, curbPreviewEndT)
    const endT = Math.max(curbDragState.startT, curbPreviewEndT)

    if (Math.abs(endT - startT) < 0.05) return

    const newCurb: PlacedObject = {
      id: generateId(),
      type: 'curb',
      position: [0, 0, 0],
      rotation: 0,
      parentRoadId: curbDragState.roadId,
      edgeSide: curbDragState.edge,
      startT,
      endT,
    }

    const command: EditorCommand = {
      execute: () => useCustomizationStore.getState().addObject(newCurb),
      undo: () => useCustomizationStore.getState().removeObject(newCurb.id),
      description: 'Place curb',
    }
    editorCommandStack.push(command)

    set({
      placementState: 'selecting',
      curbDragState: null,
      curbPreviewEndT: null,
      curbPreviewEndPosition: null,
    })
  },

  cancelCurbPlacement: () =>
    set({
      placementState: get().selectedObjectType ? 'selecting' : 'idle',
      curbDragState: null,
      curbPreviewEndT: null,
      curbPreviewEndPosition: null,
    }),

  setPartialDeleteMode: enabled =>
    set({
      partialDeleteMode: enabled,
      partialDeleteState: null,
      partialDeletePreviewT: null,
      partialDeletePreviewPosition: null,
      ...(enabled
        ? {
            selectedObjectType: null,
            deleteMode: false,
            placementState: 'idle' as PlacementState,
          }
        : {}),
    }),

  startPartialDelete: (roadId, road, t, position) =>
    set({
      partialDeleteState: { roadId, road, startT: t, startPosition: position },
      partialDeletePreviewT: t,
      partialDeletePreviewPosition: position,
    }),

  updatePartialDeletePreview: (t, position) =>
    set({
      partialDeletePreviewT: t,
      partialDeletePreviewPosition: position,
    }),

  confirmPartialDelete: () => {
    const state = get()
    const { partialDeleteState, partialDeletePreviewT } = state

    if (!partialDeleteState || partialDeletePreviewT === null) return

    const deleteStartT = Math.min(partialDeleteState.startT, partialDeletePreviewT)
    const deleteEndT = Math.max(partialDeleteState.startT, partialDeletePreviewT)

    if (Math.abs(deleteEndT - deleteStartT) < 0.05) return

    const newRoads = splitRoadAtSegment(
      partialDeleteState.road,
      deleteStartT,
      deleteEndT,
      generateId,
    )

    const snapshotBefore = [...useCustomizationStore.getState().placedObjects]

    const command: EditorCommand = {
      execute: () => {
        useCustomizationStore.getState().performPartialDelete(
          partialDeleteState.roadId,
          newRoads,
          deleteStartT,
          deleteEndT,
        )
      },
      undo: () => {
        useCustomizationStore.getState().setPlacedObjects(snapshotBefore)
      },
      description: 'Partial delete road',
    }
    editorCommandStack.push(command)

    set({
      partialDeleteState: null,
      partialDeletePreviewT: null,
      partialDeletePreviewPosition: null,
    })
  },

  cancelPartialDelete: () =>
    set({
      partialDeleteState: null,
      partialDeletePreviewT: null,
      partialDeletePreviewPosition: null,
    }),

  setAutoCurbMode: enabled =>
    set({
      autoCurbMode: enabled,
      selectedRoadIds: enabled ? get().selectedRoadIds : [],
      deleteMode: false,
      partialDeleteMode: false,
      selectedObjectType: null,
      placementState: 'idle',
    }),

  toggleRoadSelection: roadId =>
    set(state => ({
      selectedRoadIds: state.selectedRoadIds.includes(roadId)
        ? state.selectedRoadIds.filter(id => id !== roadId)
        : [...state.selectedRoadIds, roadId],
    })),

  clearRoadSelection: () => set({ selectedRoadIds: [] }),

  setSnapSettings: settings =>
    set(state => ({
      snapSettings: { ...state.snapSettings, ...settings },
    })),

  setConnectedTangent: tangent => set({ connectedTangent: tangent }),

  setSnappedAngle: angle => set({ snappedAngle: angle }),

  toggleMultiSelect: (id) => {
    set(state => ({
      multiSelectedIds: state.multiSelectedIds.includes(id)
        ? state.multiSelectedIds.filter(i => i !== id)
        : [...state.multiSelectedIds, id],
    }))
  },

  clearMultiSelection: () => set({ multiSelectedIds: [] }),

  deleteMultiSelected: () => {
    const ids = get().multiSelectedIds
    if (ids.length === 0) return
    const customStore = useCustomizationStore.getState()
    for (const id of ids) {
      customStore.removeObject(id)
    }
    set({ multiSelectedIds: [] })
  },

  copySelected: () => {
    const state = get()
    const customStore = useCustomizationStore.getState()
    const ids = state.multiSelectedIds.length > 0
      ? state.multiSelectedIds
      : state.selectedObjectId
        ? [state.selectedObjectId]
        : []

    if (ids.length === 0) return

    const objects = customStore.placedObjects.filter(o => ids.includes(o.id))
    set({ clipboard: objects })
  },

  pasteAtPosition: (pos) => {
    const { clipboard } = get()
    if (clipboard.length === 0) return

    const customStore = useCustomizationStore.getState()

    let cx = 0, cz = 0
    for (const obj of clipboard) {
      cx += obj.position[0]
      cz += obj.position[2]
    }
    cx /= clipboard.length
    cz /= clipboard.length

    const dx = pos[0] - cx
    const dz = pos[2] - cz

    for (const obj of clipboard) {
      const newObj: PlacedObject = {
        ...obj,
        id: generateId(),
        position: [obj.position[0] + dx, obj.position[1], obj.position[2] + dz],
      }
      if (newObj.startPoint) {
        newObj.startPoint = [newObj.startPoint[0] + dx, newObj.startPoint[1], newObj.startPoint[2] + dz]
      }
      if (newObj.endPoint) {
        newObj.endPoint = [newObj.endPoint[0] + dx, newObj.endPoint[1], newObj.endPoint[2] + dz]
      }
      if (newObj.controlPoint) {
        newObj.controlPoint = [newObj.controlPoint[0] + dx, newObj.controlPoint[1], newObj.controlPoint[2] + dz]
      }
      customStore.addObject(newObj)
    }
  },
}))

editorCommandStack.subscribe(() => {
  useEditorStore.setState({
    canUndo: editorCommandStack.canUndo,
    canRedo: editorCommandStack.canRedo,
    undoDescription: editorCommandStack.undoDescription,
    redoDescription: editorCommandStack.redoDescription,
  })
})
