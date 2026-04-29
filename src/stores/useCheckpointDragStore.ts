import { create } from 'zustand'
import type { EditorCommand } from '../types/editor'
import { alignCheckpointToRoad } from '../utils/checkpointAlignment'
import { editorCommandStack } from '../utils/commandStack'
import { useCustomizationStore } from './useCustomizationStore'

export interface CheckpointDragState {
  checkpointId: string
  handle: 'start' | 'end' | 'center'
  initialStartPoint: [number, number, number]
  initialEndPoint: [number, number, number]
}

interface CheckpointDragStoreState {
  checkpointDragState: CheckpointDragState | null

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
  deleteSectorCheckpoint: (id: string, onAfterDelete?: () => void) => void
}

export const useCheckpointDragStore = create<CheckpointDragStoreState>((set, get) => ({
  checkpointDragState: null,

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
    const drag = get().checkpointDragState
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
    const drag = get().checkpointDragState
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

  deleteSectorCheckpoint: (id, onAfterDelete) => {
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

    onAfterDelete?.()
  },
}))
