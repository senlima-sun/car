import { create } from 'zustand'
import type { PlacedObject } from '../types/trackObjects'

export type {
  ObjectType,
  TrackMode,
  CheckpointType,
  PlacedObject,
  CurbDragState,
  PartialDeleteState,
  SnapPointWithDirection,
  RoadEdgeResult,
  RoadEdgeHitResult,
  RoadSurfaceHitResult,
} from '../types/trackObjects'
export { isLinearObject } from '../types/trackObjects'
export {
  getSnapPoints,
  findNearestSnapPoint,
  findRoadAtPosition,
  findRoadEdgeAtPosition,
  getRoadEdgePositionAt,
  findRoadSurfaceAtPosition,
  getRoadCenterPositionAt,
  splitRoadAtSegment,
  getElevationAtWorldPosition,
} from '../utils/roadGeometry'
export type { SnapSettings } from '../utils/roadSnapping'

const STORAGE_KEY = 'car-racing-track'

const generateId = (): string => {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

interface CustomizationState {
  placedObjects: PlacedObject[]

  addObject: (obj: PlacedObject) => void
  replaceCheckpoint: (obj: PlacedObject) => void
  removeObject: (id: string) => void
  clearAll: () => void
  loadFromStorage: () => void
  saveToStorage: () => void
  setPlacedObjects: (objects: PlacedObject[]) => void
  updateObject: (id: string, updates: Partial<PlacedObject>) => void
  renumberSectorCheckpoints: () => void
  addGeneratedCurbs: (curbs: PlacedObject[]) => void
  performPartialDelete: (
    roadId: string,
    newRoads: PlacedObject[],
    deleteStartT: number,
    deleteEndT: number,
  ) => void
}

export const useCustomizationStore = create<CustomizationState>((set, get) => ({
  placedObjects: [],

  addObject: (obj: PlacedObject) => {
    set(state => {
      let nextObj = obj
      if (obj.type === 'corner' && obj.cornerNumber == null) {
        const maxCorner = state.placedObjects
          .filter(o => o.type === 'corner')
          .reduce((m, o) => Math.max(m, o.cornerNumber ?? 0), 0)
        nextObj = { ...obj, cornerNumber: maxCorner + 1 }
      }
      return { placedObjects: [...state.placedObjects, nextObj] }
    })
    setTimeout(() => get().saveToStorage(), 0)
  },

  replaceCheckpoint: (obj: PlacedObject) => {
    set(state => ({
      placedObjects: [
        ...state.placedObjects.filter(
          o =>
            !(o.type === 'checkpoint' && (o.checkpointType ?? 'start-finish') === 'start-finish'),
        ),
        obj,
      ],
    }))
    setTimeout(() => get().saveToStorage(), 0)
  },

  removeObject: id => {
    set(state => {
      const objectToRemove = state.placedObjects.find(obj => obj.id === id)
      let idsToRemove = [id]

      if (objectToRemove?.type === 'road') {
        const attachedCurbIds = state.placedObjects
          .filter(obj => obj.type === 'curb' && obj.parentRoadId === id)
          .map(obj => obj.id)
        idsToRemove = [...idsToRemove, ...attachedCurbIds]
      }

      return {
        placedObjects: state.placedObjects.filter(obj => !idsToRemove.includes(obj.id)),
      }
    })
    setTimeout(() => get().saveToStorage(), 0)
  },

  clearAll: () => {
    set({ placedObjects: [] })
    localStorage.removeItem(STORAGE_KEY)
  },

  loadFromStorage: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const objects = JSON.parse(data) as PlacedObject[]
        set({ placedObjects: objects })
      }
    } catch (e) {
      console.error('Failed to load track from storage:', e)
    }
  },

  saveToStorage: () => {
    try {
      const { placedObjects } = get()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(placedObjects))
    } catch (e) {
      console.error('Failed to save track to storage:', e)
    }
  },

  setPlacedObjects: (objects: PlacedObject[]) => {
    set({ placedObjects: objects })
  },

  updateObject: (id, updates) => {
    set(state => ({
      placedObjects: state.placedObjects.map(obj => (obj.id === id ? { ...obj, ...updates } : obj)),
    }))
    setTimeout(() => get().saveToStorage(), 0)
  },

  renumberSectorCheckpoints: () => {
    set(state => {
      const sectors = state.placedObjects
        .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
        .sort((a, b) => (a.checkpointOrder ?? 0) - (b.checkpointOrder ?? 0))

      if (sectors.length === 0) return state

      const reorderedIds = new Map<string, number>()
      sectors.forEach((s, i) => reorderedIds.set(s.id, i + 1))

      return {
        placedObjects: state.placedObjects.map(obj =>
          reorderedIds.has(obj.id) ? { ...obj, checkpointOrder: reorderedIds.get(obj.id)! } : obj,
        ),
      }
    })
    setTimeout(() => get().saveToStorage(), 0)
  },

  addGeneratedCurbs: curbs => {
    set(state => ({
      placedObjects: [...state.placedObjects, ...curbs],
    }))
    setTimeout(() => get().saveToStorage(), 0)
  },

  performPartialDelete: (roadId, newRoads, deleteStartT, deleteEndT) => {
    set(state => {
      const attachedCurbs = state.placedObjects.filter(
        obj => obj.type === 'curb' && obj.parentRoadId === roadId,
      )

      const updatedCurbs: PlacedObject[] = []
      for (const curb of attachedCurbs) {
        const curbStart = curb.startT ?? 0
        const curbEnd = curb.endT ?? 1

        if (curbEnd <= deleteStartT && newRoads.length > 0) {
          const remapT = (t: number) => t / deleteStartT
          updatedCurbs.push({
            ...curb,
            id: generateId(),
            parentRoadId: newRoads[0].id,
            startT: remapT(curbStart),
            endT: remapT(curbEnd),
          })
        } else if (curbStart >= deleteEndT && newRoads.length > (deleteStartT > 0.05 ? 1 : 0)) {
          const targetRoadIndex = deleteStartT > 0.05 ? 1 : 0
          if (newRoads[targetRoadIndex]) {
            const remapT = (t: number) => (t - deleteEndT) / (1 - deleteEndT)
            updatedCurbs.push({
              ...curb,
              id: generateId(),
              parentRoadId: newRoads[targetRoadIndex].id,
              startT: remapT(curbStart),
              endT: remapT(curbEnd),
            })
          }
        }
      }

      return {
        placedObjects: [
          ...state.placedObjects.filter(
            obj => obj.id !== roadId && !attachedCurbs.some(c => c.id === obj.id),
          ),
          ...newRoads,
          ...updatedCurbs,
        ],
      }
    })
    setTimeout(() => get().saveToStorage(), 0)
  },
}))
