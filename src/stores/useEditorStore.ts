import { create } from 'zustand'
import {
  type ObjectType,
  type TrackMode,
  type PlacementState,
  type CurbDragState,
  type PartialDeleteState,
  type PlacedObject,
  type CheckpointType,
  isLinearObject,
  isCurveMode,
  isPitRoad,
  isWallType,
} from '../types/trackObjects'
import type { OverlapResult } from '../utils/trackConnection'
import { autoTrimOverlap } from '../utils/trackConnection'
import { findBarriersOnRoad } from '../utils/trackValidation'
import type { EditorCommand } from '../types/editor'

export interface CheckpointDragState {
  checkpointId: string
  handle: 'start' | 'end' | 'center'
  initialStartPoint: [number, number, number]
  initialEndPoint: [number, number, number]
}
import { SnapSettings, DEFAULT_SNAP_SETTINGS } from '../utils/roadSnapping'
import { splitRoadAtSegment, getRoadCenterPositionAt } from '../utils/roadGeometry'
import { alignCheckpointToRoad } from '../utils/checkpointAlignment'
import { PIT_ROAD_WIDTH, PIT_BOX_WIDTH } from '../constants/trackObjects'
import { editorCommandStack } from '../utils/commandStack'
import { useCustomizationStore } from './useCustomizationStore'
import { useElevationEditStore } from './useElevationEditStore'

export type { SnapSettings }

export type EditorMode =
  | 'idle'
  | 'place'
  | 'delete'
  | 'partialDelete'
  | 'autoCurb'
  | 'elevation'
  | 'terrain'

const ROTATION_STEP = Math.PI / 8

const generateId = (): string => {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

interface EditorState {
  editorMode: EditorMode
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
  startSnapElevation: number | null
  endSnapElevation: number | null
  startSnapBanking: number | null
  endSnapBanking: number | null
  connectedTangent: [number, number, number] | null
  snappedAngle: number | null
  checkpointPlacementType: CheckpointType
  canUndo: boolean
  canRedo: boolean
  undoDescription: string | null
  redoDescription: string | null
  symmetricCurve: boolean
  multiSelectedIds: string[]
  clipboard: PlacedObject[]
  cameraTarget: [number, number, number] | null
  isObliqueView: boolean
  elevationEditMode: boolean
  terrainEditMode: boolean
  overlapResult: OverlapResult | null
  polygonPoints: Array<[number, number, number]>
  checkpointDragState: CheckpointDragState | null

  setEditorMode: (mode: EditorMode) => void
  startCheckpointDrag: (
    id: string,
    handle: 'start' | 'end' | 'center',
    startPoint: [number, number, number],
    endPoint: [number, number, number],
  ) => void
  updateCheckpointDrag: (worldPos: [number, number, number]) => void
  confirmCheckpointDrag: () => void
  cancelCheckpointDrag: () => void
  reorderSectorCheckpoint: (id: string, direction: 'up' | 'down') => void
  deleteSectorCheckpoint: (id: string) => void
  setOverlapResult: (result: OverlapResult | null) => void
  addPolygonPoint: (point: [number, number, number]) => void
  undoLastPolygonPoint: () => void
  closePolygon: () => void
  cancelPolygon: () => void
  setElevationEditMode: (enabled: boolean) => void
  setTerrainEditMode: (enabled: boolean) => void
  setSymmetricCurve: (enabled: boolean) => void
  setObliqueView: (v: boolean) => void
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
  setStartSnapElevation: (elevation: number | null) => void
  setEndSnapElevation: (elevation: number | null) => void
  setStartSnapBanking: (banking: number | null) => void
  setEndSnapBanking: (banking: number | null) => void
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
  setCameraTarget: (pos: [number, number, number] | null) => void
}

const IDLE_MODE_FIELDS = {
  editorMode: 'idle' as EditorMode,
  deleteMode: false,
  partialDeleteMode: false,
  autoCurbMode: false,
  elevationEditMode: false,
  terrainEditMode: false,
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editorMode: 'idle',
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
  startSnapElevation: null,
  endSnapElevation: null,
  startSnapBanking: null,
  endSnapBanking: null,
  connectedTangent: null,
  snappedAngle: null,
  checkpointPlacementType: 'start-finish' as CheckpointType,
  canUndo: false,
  canRedo: false,
  undoDescription: null,
  redoDescription: null,
  symmetricCurve: false,
  multiSelectedIds: [],
  clipboard: [],
  cameraTarget: null,
  isObliqueView: false,
  elevationEditMode: false,
  terrainEditMode: false,
  overlapResult: null,
  polygonPoints: [],
  checkpointDragState: null,

  setEditorMode: mode => {
    switch (mode) {
      case 'idle':
        set({
          ...IDLE_MODE_FIELDS,
          selectedObjectType: null,
          placementState: 'idle' as PlacementState,
          selectedRoadIds: [],
        })
        break
      case 'place':
        set({
          ...IDLE_MODE_FIELDS,
          editorMode: 'place',
          placementState: 'selecting' as PlacementState,
        })
        break
      case 'delete':
        set({
          ...IDLE_MODE_FIELDS,
          editorMode: 'delete',
          deleteMode: true,
          selectedObjectType: null,
          selectedRoadIds: [],
          placementState: 'idle' as PlacementState,
        })
        break
      case 'partialDelete':
        set({
          ...IDLE_MODE_FIELDS,
          editorMode: 'partialDelete',
          partialDeleteMode: true,
          selectedObjectType: null,
          selectedRoadIds: [],
          placementState: 'idle' as PlacementState,
          partialDeleteState: null,
          partialDeletePreviewT: null,
          partialDeletePreviewPosition: null,
        })
        break
      case 'autoCurb':
        set({
          ...IDLE_MODE_FIELDS,
          editorMode: 'autoCurb',
          autoCurbMode: true,
          selectedObjectType: null,
          placementState: 'idle' as PlacementState,
        })
        break
      case 'elevation': {
        useElevationEditStore.getState().clearSmoothSelection()
        useElevationEditStore.setState({ slopeAnchor: null, elevationDragState: null })
        set({
          ...IDLE_MODE_FIELDS,
          editorMode: 'elevation',
          elevationEditMode: true,
          selectedObjectType: null,
          selectedRoadIds: [],
          placementState: 'idle' as PlacementState,
        })
        break
      }
      case 'terrain':
        set({
          ...IDLE_MODE_FIELDS,
          editorMode: 'terrain',
          terrainEditMode: true,
        })
        break
    }
  },

  startCheckpointDrag: (id, handle, startPoint, endPoint) =>
    set({
      checkpointDragState: {
        checkpointId: id,
        handle,
        initialStartPoint: startPoint,
        initialEndPoint: endPoint,
      },
    }),

  updateCheckpointDrag: worldPos => {
    const state = get()
    const drag = state.checkpointDragState
    if (!drag) return

    const customStore = useCustomizationStore.getState()
    const obj = customStore.placedObjects.find(o => o.id === drag.checkpointId)
    if (!obj) return

    let newStart: [number, number, number]
    let newEnd: [number, number, number]

    if (drag.handle === 'start') {
      newStart = worldPos
      newEnd = obj.endPoint ?? drag.initialEndPoint
    } else if (drag.handle === 'end') {
      newStart = obj.startPoint ?? drag.initialStartPoint
      newEnd = worldPos
    } else {
      const curStart = obj.startPoint ?? drag.initialStartPoint
      const curEnd = obj.endPoint ?? drag.initialEndPoint
      const cx = (curStart[0] + curEnd[0]) / 2
      const cz = (curStart[2] + curEnd[2]) / 2
      const dx = worldPos[0] - cx
      const dz = worldPos[2] - cz
      newStart = [curStart[0] + dx, curStart[1], curStart[2] + dz]
      newEnd = [curEnd[0] + dx, curEnd[1], curEnd[2] + dz]
    }

    const position: [number, number, number] = [
      (newStart[0] + newEnd[0]) / 2,
      0,
      (newStart[2] + newEnd[2]) / 2,
    ]
    const rotation = Math.atan2(newEnd[0] - newStart[0], newEnd[2] - newStart[2])

    customStore.updateObject(drag.checkpointId, {
      startPoint: newStart,
      endPoint: newEnd,
      position,
      rotation,
    })
  },

  confirmCheckpointDrag: () => {
    const state = get()
    const drag = state.checkpointDragState
    if (!drag) return

    const customStore = useCustomizationStore.getState()
    const obj = customStore.placedObjects.find(o => o.id === drag.checkpointId)
    if (!obj) {
      set({ checkpointDragState: null })
      return
    }

    const rawStart = obj.startPoint ?? drag.initialStartPoint
    const rawEnd = obj.endPoint ?? drag.initialEndPoint

    if (
      rawStart[0] === drag.initialStartPoint[0] &&
      rawStart[2] === drag.initialStartPoint[2] &&
      rawEnd[0] === drag.initialEndPoint[0] &&
      rawEnd[2] === drag.initialEndPoint[2]
    ) {
      set({ checkpointDragState: null })
      return
    }

    const roads = customStore.placedObjects.filter(o => o.type === 'road')
    const aligned = alignCheckpointToRoad(rawStart, rawEnd, roads)
    const afterStart = aligned.startPoint
    const afterEnd = aligned.endPoint

    const afterPosition: [number, number, number] = [
      (afterStart[0] + afterEnd[0]) / 2,
      0,
      (afterStart[2] + afterEnd[2]) / 2,
    ]
    const afterRotation = Math.atan2(afterEnd[0] - afterStart[0], afterEnd[2] - afterStart[2])
    const beforeStart = drag.initialStartPoint
    const beforeEnd = drag.initialEndPoint
    const beforePosition: [number, number, number] = [
      (beforeStart[0] + beforeEnd[0]) / 2,
      0,
      (beforeStart[2] + beforeEnd[2]) / 2,
    ]
    const beforeRotation = Math.atan2(beforeEnd[0] - beforeStart[0], beforeEnd[2] - beforeStart[2])
    const cpId = drag.checkpointId

    const command: EditorCommand = {
      execute: () => {
        useCustomizationStore.getState().updateObject(cpId, {
          startPoint: afterStart,
          endPoint: afterEnd,
          position: afterPosition,
          rotation: afterRotation,
        })
      },
      undo: () => {
        useCustomizationStore.getState().updateObject(cpId, {
          startPoint: beforeStart,
          endPoint: beforeEnd,
          position: beforePosition,
          rotation: beforeRotation,
        })
      },
      description: 'Move checkpoint',
    }
    editorCommandStack.push(command)

    set({ checkpointDragState: null })
  },

  cancelCheckpointDrag: () => {
    const drag = get().checkpointDragState
    if (!drag) return

    const position: [number, number, number] = [
      (drag.initialStartPoint[0] + drag.initialEndPoint[0]) / 2,
      0,
      (drag.initialStartPoint[2] + drag.initialEndPoint[2]) / 2,
    ]
    const rotation = Math.atan2(
      drag.initialEndPoint[0] - drag.initialStartPoint[0],
      drag.initialEndPoint[2] - drag.initialStartPoint[2],
    )

    useCustomizationStore.getState().updateObject(drag.checkpointId, {
      startPoint: drag.initialStartPoint,
      endPoint: drag.initialEndPoint,
      position,
      rotation,
    })

    set({ checkpointDragState: null })
  },

  reorderSectorCheckpoint: (id, direction) => {
    const customStore = useCustomizationStore.getState()
    const sectors = customStore.placedObjects
      .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
      .sort((a, b) => (a.checkpointOrder ?? 0) - (b.checkpointOrder ?? 0))

    const idx = sectors.findIndex(s => s.id === id)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sectors.length) return

    const a = sectors[idx]
    const b = sectors[swapIdx]
    const aOrder = a.checkpointOrder ?? idx + 1
    const bOrder = b.checkpointOrder ?? swapIdx + 1

    const command: EditorCommand = {
      execute: () => {
        const store = useCustomizationStore.getState()
        store.updateObject(a.id, { checkpointOrder: bOrder })
        store.updateObject(b.id, { checkpointOrder: aOrder })
      },
      undo: () => {
        const store = useCustomizationStore.getState()
        store.updateObject(a.id, { checkpointOrder: aOrder })
        store.updateObject(b.id, { checkpointOrder: bOrder })
      },
      description: `Reorder sector ${direction}`,
    }
    editorCommandStack.push(command)
  },

  deleteSectorCheckpoint: id => {
    const customStore = useCustomizationStore.getState()
    const obj = customStore.placedObjects.find(o => o.id === id)
    if (!obj || obj.type !== 'checkpoint') return

    const snapshotBefore = customStore.placedObjects
      .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
      .map(o => ({ id: o.id, order: o.checkpointOrder ?? 0 }))

    const command: EditorCommand = {
      execute: () => {
        const store = useCustomizationStore.getState()
        store.removeObject(id)
        store.renumberSectorCheckpoints()
      },
      undo: () => {
        const store = useCustomizationStore.getState()
        store.addObject(obj)
        for (const snap of snapshotBefore) {
          store.updateObject(snap.id, { checkpointOrder: snap.order })
        }
      },
      description: `Delete sector S${obj.checkpointOrder ?? '?'}`,
    }
    editorCommandStack.push(command)

    useEditorStore.getState().selectObject(null)
  },

  addPolygonPoint: point => {
    const state = get()
    const points = state.polygonPoints

    if (points.length >= 30) return

    if (points.length >= 3) {
      const first = points[0]
      const dx = point[0] - first[0]
      const dz = point[2] - first[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 1.5) {
        get().closePolygon()
        return
      }
    }

    if (state.placementState !== 'polygonDrawing') {
      set({ polygonPoints: [point], placementState: 'polygonDrawing' as PlacementState })
    } else {
      set({ polygonPoints: [...points, point] })
    }
  },

  undoLastPolygonPoint: () => {
    const points = get().polygonPoints
    if (points.length <= 1) {
      set({ polygonPoints: [], placementState: 'selecting' as PlacementState })
    } else {
      set({ polygonPoints: points.slice(0, -1) })
    }
  },

  closePolygon: () => {
    const state = get()
    const points = state.polygonPoints
    if (points.length < 3 || !state.selectedObjectType) return

    const center: [number, number, number] = [
      points.reduce((s, p) => s + p[0], 0) / points.length,
      0,
      points.reduce((s, p) => s + p[2], 0) / points.length,
    ]

    const newObject: PlacedObject = {
      id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: state.selectedObjectType,
      position: center,
      rotation: 0,
      polygonPoints: points,
    }

    const command: EditorCommand = {
      execute: () => useCustomizationStore.getState().addObject(newObject),
      undo: () => useCustomizationStore.getState().removeObject(newObject.id),
      description: `Place ${newObject.type}`,
    }
    editorCommandStack.push(command)

    set({ polygonPoints: [], placementState: 'selecting' as PlacementState })
  },

  cancelPolygon: () => {
    set({
      polygonPoints: [],
      placementState: get().selectedObjectType
        ? ('selecting' as PlacementState)
        : ('idle' as PlacementState),
    })
  },

  setOverlapResult: result => set({ overlapResult: result }),

  setElevationEditMode: enabled => {
    if (enabled) {
      get().setEditorMode('elevation')
    } else {
      useElevationEditStore.setState({
        elevationDragState: null,
        slopeAnchor: null,
        smoothSelectedRoadIds: [],
      })
      set({
        editorMode: 'idle',
        elevationEditMode: false,
      })
    }
  },

  setTerrainEditMode: enabled => {
    if (enabled) {
      get().setEditorMode('terrain')
    } else {
      set({
        editorMode: 'idle',
        terrainEditMode: false,
      })
    }
  },

  setSymmetricCurve: enabled => set({ symmetricCurve: enabled }),

  setObliqueView: v => set({ isObliqueView: v }),

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
        startSnapElevation: null,
        endSnapElevation: null,
        startSnapBanking: null,
        endSnapBanking: null,
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
        startSnapElevation: null,
        endSnapElevation: null,
        startSnapBanking: null,
        endSnapBanking: null,
        connectedTangent: null,
        snappedAngle: null,
        ...IDLE_MODE_FIELDS,
        editorMode: 'place',
        deleteMode: false,
        partialDeleteMode: false,
        elevationEditMode: false,
        terrainEditMode: false,
        autoCurbMode: false,
        selectedRoadIds: [],
      })
      useElevationEditStore.setState({
        elevationDragState: null,
        slopeAnchor: null,
        smoothSelectedRoadIds: [],
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
      startSnapElevation: null,
      endSnapElevation: null,
      startSnapBanking: null,
      endSnapBanking: null,
      connectedTangent: null,
      snappedAngle: null,
    }),

  setDeleteMode: enabled => {
    if (enabled) {
      get().setEditorMode('delete')
      set({ selectedObjectId: get().selectedObjectId })
    } else {
      set({
        editorMode: 'idle',
        deleteMode: false,
      })
    }
  },

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

  setStartSnapElevation: elevation => set({ startSnapElevation: elevation }),
  setEndSnapElevation: elevation => set({ endSnapElevation: elevation }),
  setStartSnapBanking: banking => set({ startSnapBanking: banking }),
  setEndSnapBanking: banking => set({ endSnapBanking: banking }),

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
      startSnapElevation,
      endSnapElevation,
      startSnapBanking,
      endSnapBanking,
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
      newObject.trackMode = isWallType(selectedObjectType) ? 'straight' : trackMode

      if (isPitRoad(trackMode)) {
        newObject.width = 8
      }

      if (startSnapElevation !== null) {
        newObject.startElevation = startSnapElevation
      }
      if (endSnapElevation !== null) {
        newObject.endElevation = endSnapElevation
      }
      if (startSnapBanking !== null || endSnapBanking !== null) {
        newObject.banking = endSnapBanking ?? startSnapBanking ?? 0
      }

      if (startSnapEdges) {
        newObject.startLeftEdge = startSnapEdges.left
        newObject.startRightEdge = startSnapEdges.right
      }
      if (endSnapEdges) {
        newObject.endLeftEdge = endSnapEdges.left
        newObject.endRightEdge = endSnapEdges.right
      }

      if (isCurveMode(trackMode) && controlPoint) {
        let effectiveControlPoint = controlPoint
        if (state.symmetricCurve) {
          const mx = (dragStartPoint[0] + previewPosition[0]) / 2
          const mz = (dragStartPoint[2] + previewPosition[2]) / 2
          const dx = previewPosition[0] - dragStartPoint[0]
          const dz = previewPosition[2] - dragStartPoint[2]
          const len = Math.sqrt(dx * dx + dz * dz)
          if (len > 0.01) {
            const nx = -dz / len
            const nz = dx / len
            const vx = controlPoint[0] - mx
            const vz = controlPoint[2] - mz
            const proj = vx * nx + vz * nz
            effectiveControlPoint = [mx + proj * nx, 0, mz + proj * nz]
          }
        }
        newObject.controlPoint = effectiveControlPoint
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

    if (
      (newObject.type === 'barrier' || isWallType(newObject.type)) &&
      newObject.startPoint &&
      newObject.endPoint
    ) {
      const roads = useCustomizationStore.getState().placedObjects.filter(o => o.type === 'road')
      const onRoad = findBarriersOnRoad([newObject], roads)
      if (onRoad.length > 0) {
        set({
          placementState: 'selecting',
          dragStartPoint: null,
          controlPoint: null,
          startSnapEdges: null,
          endSnapEdges: null,
          startSnapElevation: null,
          endSnapElevation: null,
          startSnapBanking: null,
          endSnapBanking: null,
          connectedTangent: null,
          snappedAngle: null,
        })
        return
      }
    }

    let finalObject = newObject
    if (newObject.type === 'road' && state.overlapResult?.hasOverlap) {
      const trimmed = autoTrimOverlap(newObject, state.overlapResult)
      if (!trimmed) {
        set({
          placementState: 'selecting',
          dragStartPoint: null,
          controlPoint: null,
          startSnapEdges: null,
          endSnapEdges: null,
          startSnapElevation: null,
          endSnapElevation: null,
          startSnapBanking: null,
          endSnapBanking: null,
          connectedTangent: null,
          snappedAngle: null,
          overlapResult: null,
        })
        return
      }
      finalObject = trimmed
    }

    const command: EditorCommand = {
      execute: () => useCustomizationStore.getState().addObject(finalObject),
      undo: () => useCustomizationStore.getState().removeObject(finalObject.id),
      description: `Place ${finalObject.type}`,
    }
    editorCommandStack.push(command)

    set({
      placementState: 'selecting',
      dragStartPoint: null,
      controlPoint: null,
      startSnapEdges: null,
      endSnapEdges: null,
      startSnapElevation: null,
      endSnapElevation: null,
      startSnapBanking: null,
      endSnapBanking: null,
      overlapResult: null,
      connectedTangent: null,
      snappedAngle: null,
    })
  },

  confirmCheckpointPlacement: (startPoint, endPoint) => {
    const state = get()
    const customStore = useCustomizationStore.getState()
    const cpType = state.checkpointPlacementType

    const roads = customStore.placedObjects.filter(o => o.type === 'road')
    const aligned = alignCheckpointToRoad(startPoint, endPoint, roads)

    const sectorCheckpoints = customStore.placedObjects.filter(
      o => o.type === 'checkpoint' && o.checkpointType === 'sector',
    )
    const nextOrder = cpType === 'sector' ? sectorCheckpoints.length + 1 : 0

    const newObject: PlacedObject = {
      id: generateId(),
      type: 'checkpoint',
      position: [
        (aligned.startPoint[0] + aligned.endPoint[0]) / 2,
        0,
        (aligned.startPoint[2] + aligned.endPoint[2]) / 2,
      ],
      rotation: Math.atan2(
        aligned.endPoint[0] - aligned.startPoint[0],
        aligned.endPoint[2] - aligned.startPoint[2],
      ),
      startPoint: aligned.startPoint,
      endPoint: aligned.endPoint,
      checkpointType: cpType,
      checkpointOrder: nextOrder,
    }

    if (cpType === 'start-finish') {
      const previousStartFinish =
        customStore.placedObjects.find(
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
        execute: () => {
          useCustomizationStore.getState().addObject(newObject)
          useCustomizationStore.getState().renumberSectorCheckpoints()
        },
        undo: () => {
          useCustomizationStore.getState().removeObject(newObject.id)
          useCustomizationStore.getState().renumberSectorCheckpoints()
        },
        description: `Place sector ${nextOrder}`,
      }
      editorCommandStack.push(command)
    }

    set({
      placementState: 'selecting',
    })
  },

  setCheckpointPlacementType: type => {
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
      startSnapElevation: null,
      endSnapElevation: null,
      startSnapBanking: null,
      endSnapBanking: null,
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
    const { curbDragState, curbPreviewEndT, selectedObjectType } = state

    if (!curbDragState || curbPreviewEndT === null) return

    const startT = Math.min(curbDragState.startT, curbPreviewEndT)
    const endT = Math.max(curbDragState.startT, curbPreviewEndT)

    if (Math.abs(endT - startT) < 0.05) return

    const objectType = selectedObjectType === 'pitbox' ? 'pitbox' : 'curb'

    let pitboxPosition: [number, number, number] = [0, 0, 0]
    let pitboxRotation = 0

    if (objectType === 'pitbox' && curbDragState.road.startPoint && curbDragState.road.endPoint) {
      const midT = (startT + endT) / 2
      const centerPos = getRoadCenterPositionAt(curbDragState.road, midT)
      const roadStart = curbDragState.road.startPoint
      const roadEnd = curbDragState.road.endPoint
      const dx = roadEnd[0] - roadStart[0]
      const dz = roadEnd[2] - roadStart[2]
      const len = Math.sqrt(dx * dx + dz * dz)
      if (len > 0) {
        const perpX = -dz / len
        const perpZ = dx / len
        const edgeSign = curbDragState.edge === 'left' ? 1 : -1
        const offsetDist = PIT_ROAD_WIDTH / 2 + PIT_BOX_WIDTH / 2
        pitboxPosition = [
          centerPos[0] + perpX * edgeSign * offsetDist,
          centerPos[1],
          centerPos[2] + perpZ * edgeSign * offsetDist,
        ]
        pitboxRotation = Math.atan2(dx, dz)
      }
    }

    const newObject: PlacedObject = {
      id: generateId(),
      type: objectType,
      position: objectType === 'pitbox' ? pitboxPosition : [0, 0, 0],
      rotation: objectType === 'pitbox' ? pitboxRotation : 0,
      parentRoadId: curbDragState.roadId,
      edgeSide: curbDragState.edge,
      startT,
      endT,
    }

    const command: EditorCommand = {
      execute: () => useCustomizationStore.getState().addObject(newObject),
      undo: () => useCustomizationStore.getState().removeObject(newObject.id),
      description: `Place ${objectType}`,
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

  setPartialDeleteMode: enabled => {
    if (enabled) {
      get().setEditorMode('partialDelete')
    } else {
      set({
        editorMode: 'idle',
        partialDeleteMode: false,
        partialDeleteState: null,
        partialDeletePreviewT: null,
        partialDeletePreviewPosition: null,
      })
    }
  },

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
        useCustomizationStore
          .getState()
          .performPartialDelete(partialDeleteState.roadId, newRoads, deleteStartT, deleteEndT)
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

  setAutoCurbMode: enabled => {
    if (enabled) {
      get().setEditorMode('autoCurb')
    } else {
      set({
        editorMode: 'idle',
        autoCurbMode: false,
        selectedRoadIds: [],
        selectedObjectType: null,
        placementState: 'idle' as PlacementState,
      })
    }
  },

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

  setCameraTarget: pos => set({ cameraTarget: pos }),

  toggleMultiSelect: id => {
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
    const ids =
      state.multiSelectedIds.length > 0
        ? state.multiSelectedIds
        : state.selectedObjectId
          ? [state.selectedObjectId]
          : []

    if (ids.length === 0) return

    const objects = customStore.placedObjects.filter(o => ids.includes(o.id))
    set({ clipboard: objects })
  },

  pasteAtPosition: pos => {
    const { clipboard } = get()
    if (clipboard.length === 0) return

    const customStore = useCustomizationStore.getState()

    let cx = 0,
      cz = 0
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
        newObj.startPoint = [
          newObj.startPoint[0] + dx,
          newObj.startPoint[1],
          newObj.startPoint[2] + dz,
        ]
      }
      if (newObj.endPoint) {
        newObj.endPoint = [newObj.endPoint[0] + dx, newObj.endPoint[1], newObj.endPoint[2] + dz]
      }
      if (newObj.controlPoint) {
        newObj.controlPoint = [
          newObj.controlPoint[0] + dx,
          newObj.controlPoint[1],
          newObj.controlPoint[2] + dz,
        ]
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
