import { create } from 'zustand'
import type { TrackPath, TrackPathControlPoint } from '@/types/trackPath'
import type { PlacedObject } from '@/types/trackObjects'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { PIT_ROAD_WIDTH } from '@/constants/trackObjects'
import { segmentizePath } from '@/utils/trackPathSegmentizer'
import { catmullRomToHandles } from '@/utils/trackPathInterpolation'
import { importRoadsToTrackPath } from '@/utils/trackPathImporter'
import { useCustomizationStore } from './useCustomizationStore'

let idCounter = 0
const genId = (prefix: string) => `${prefix}_${Date.now()}_${++idCounter}`

interface TrackPathState {
  paths: TrackPath[]
  generatedRoadIds: Set<string>
  activePathId: string | null
  selectedPointId: string | null
  editMode: 'draw' | 'edit' | 'none'

  createPath: (type: 'main' | 'pit') => string
  deletePath: (pathId: string) => void
  setActivePath: (pathId: string | null) => void
  setEditMode: (mode: 'draw' | 'edit' | 'none') => void
  setSelectedPoint: (pointId: string | null) => void

  addControlPoint: (pathId: string, position: [number, number], index?: number) => void
  updateControlPoint: (
    pathId: string,
    pointId: string,
    updates: Partial<TrackPathControlPoint>,
    regenerate?: boolean,
  ) => void
  removeControlPoint: (pathId: string, pointId: string) => void
  closePath: (pathId: string) => void
  openPath: (pathId: string) => void

  updateHandle: (
    pathId: string,
    pointId: string,
    handle: 'in' | 'out',
    offset: [number, number],
    symmetric?: boolean,
    regenerate?: boolean,
  ) => void
  autoSmoothPoint: (pathId: string, pointId: string) => void
  autoSmoothAll: (pathId: string) => void

  regenerateRoads: () => void

  importFromPlacedObjects: () => string | null

  setPaths: (paths: TrackPath[]) => void
  getPathById: (pathId: string) => TrackPath | undefined
}

function updatePath(
  paths: TrackPath[],
  pathId: string,
  updater: (p: TrackPath) => TrackPath,
): TrackPath[] {
  return paths.map(p => (p.id === pathId ? updater(p) : p))
}

function autoSmoothCP(
  cp: TrackPathControlPoint,
  prev: TrackPathControlPoint | null,
  next: TrackPathControlPoint | null,
  closed: boolean,
): TrackPathControlPoint {
  const prevPos = prev ? prev.position : null
  const nextPos = next ? next.position : null
  const handles = catmullRomToHandles(
    prevPos && (closed || prev) ? prevPos : null,
    cp.position,
    nextPos && (closed || next) ? nextPos : null,
    0.3,
  )
  return { ...cp, handleIn: handles.handleIn, handleOut: handles.handleOut }
}

export const useTrackPathStore = create<TrackPathState>((set, get) => ({
  paths: [],
  generatedRoadIds: new Set(),
  activePathId: null,
  selectedPointId: null,
  editMode: 'none',

  createPath: type => {
    const id = genId('path')
    const path: TrackPath = {
      id,
      name: type === 'pit' ? 'Pit Lane' : 'Main Circuit',
      type,
      closed: false,
      width: type === 'pit' ? PIT_ROAD_WIDTH : TRACK_WIDTH,
      controlPoints: [],
    }
    set(state => ({
      paths: [...state.paths, path],
      activePathId: id,
      editMode: 'draw',
    }))
    return id
  },

  deletePath: pathId => {
    set(state => ({
      paths: state.paths.filter(p => p.id !== pathId),
      activePathId: state.activePathId === pathId ? null : state.activePathId,
      selectedPointId: null,
    }))
    get().regenerateRoads()
  },

  setActivePath: pathId => set({ activePathId: pathId, selectedPointId: null }),

  setEditMode: mode => set({ editMode: mode }),

  setSelectedPoint: pointId => set({ selectedPointId: pointId }),

  addControlPoint: (pathId, position, index) => {
    const cpId = genId('cp')

    set(state => ({
      paths: updatePath(state.paths, pathId, path => {
        const pts = [...path.controlPoints]
        const newCp: TrackPathControlPoint = {
          id: cpId,
          position,
          elevation: 0,
        }

        if (index !== undefined && index >= 0 && index <= pts.length) {
          pts.splice(index, 0, newCp)
        } else {
          pts.push(newCp)
        }

        const smoothed = pts.map((cp, i) => {
          const prev = i > 0 ? pts[i - 1] : path.closed ? pts[pts.length - 1] : null
          const next = i < pts.length - 1 ? pts[i + 1] : path.closed ? pts[0] : null
          return autoSmoothCP(cp, prev, next, path.closed)
        })

        return { ...path, controlPoints: smoothed }
      }),
      selectedPointId: cpId,
    }))

    get().regenerateRoads()
  },

  updateControlPoint: (pathId, pointId, updates, regenerate = true) => {
    set(state => ({
      paths: updatePath(state.paths, pathId, path => {
        const pts = path.controlPoints.map(cp => (cp.id === pointId ? { ...cp, ...updates } : cp))

        if (updates.position) {
          const idx = pts.findIndex(cp => cp.id === pointId)
          if (idx >= 0) {
            const smoothed = pts.map((cp, i) => {
              if (
                Math.abs(i - idx) > 1 &&
                !(
                  path.closed &&
                  (i === 0 || i === pts.length - 1) &&
                  (idx === 0 || idx === pts.length - 1)
                )
              ) {
                return cp
              }
              const prev = i > 0 ? pts[i - 1] : path.closed ? pts[pts.length - 1] : null
              const next = i < pts.length - 1 ? pts[i + 1] : path.closed ? pts[0] : null
              return autoSmoothCP(cp, prev, next, path.closed)
            })
            return { ...path, controlPoints: smoothed }
          }
        }

        return { ...path, controlPoints: pts }
      }),
    }))

    if (regenerate) {
      get().regenerateRoads()
    }
  },

  removeControlPoint: (pathId, pointId) => {
    set(state => ({
      paths: updatePath(state.paths, pathId, path => {
        const pts = path.controlPoints.filter(cp => cp.id !== pointId)
        const smoothed = pts.map((cp, i) => {
          const prev = i > 0 ? pts[i - 1] : path.closed ? pts[pts.length - 1] : null
          const next = i < pts.length - 1 ? pts[i + 1] : path.closed ? pts[0] : null
          return autoSmoothCP(cp, prev, next, path.closed)
        })
        return { ...path, controlPoints: smoothed }
      }),
      selectedPointId: null,
    }))

    get().regenerateRoads()
  },

  closePath: pathId => {
    set(state => ({
      paths: updatePath(state.paths, pathId, path => {
        const pts = path.controlPoints
        const smoothed = pts.map((cp, i) => {
          const prev = i > 0 ? pts[i - 1] : pts[pts.length - 1]
          const next = i < pts.length - 1 ? pts[i + 1] : pts[0]
          return autoSmoothCP(cp, prev, next, true)
        })
        return { ...path, closed: true, controlPoints: smoothed }
      }),
    }))
    get().regenerateRoads()
  },

  openPath: pathId => {
    set(state => ({
      paths: updatePath(state.paths, pathId, path => ({ ...path, closed: false })),
    }))
    get().regenerateRoads()
  },

  updateHandle: (pathId, pointId, handle, offset, symmetric = true, regenerate = true) => {
    set(state => ({
      paths: updatePath(state.paths, pathId, path => ({
        ...path,
        controlPoints: path.controlPoints.map(cp => {
          if (cp.id !== pointId) return cp
          const updates: Partial<TrackPathControlPoint> = {}
          if (handle === 'in') {
            updates.handleIn = offset
            if (symmetric) {
              updates.handleOut = [-offset[0], -offset[1]]
            }
          } else {
            updates.handleOut = offset
            if (symmetric) {
              updates.handleIn = [-offset[0], -offset[1]]
            }
          }
          return { ...cp, ...updates }
        }),
      })),
    }))
    if (regenerate) {
      get().regenerateRoads()
    }
  },

  autoSmoothPoint: (pathId, pointId) => {
    set(state => ({
      paths: updatePath(state.paths, pathId, path => {
        const pts = path.controlPoints
        const idx = pts.findIndex(cp => cp.id === pointId)
        if (idx < 0) return path
        const prev = idx > 0 ? pts[idx - 1] : path.closed ? pts[pts.length - 1] : null
        const next = idx < pts.length - 1 ? pts[idx + 1] : path.closed ? pts[0] : null
        const smoothed = [...pts]
        smoothed[idx] = autoSmoothCP(pts[idx], prev, next, path.closed)
        return { ...path, controlPoints: smoothed }
      }),
    }))
    get().regenerateRoads()
  },

  autoSmoothAll: pathId => {
    set(state => ({
      paths: updatePath(state.paths, pathId, path => {
        const pts = path.controlPoints
        const smoothed = pts.map((cp, i) => {
          const prev = i > 0 ? pts[i - 1] : path.closed ? pts[pts.length - 1] : null
          const next = i < pts.length - 1 ? pts[i + 1] : path.closed ? pts[0] : null
          return autoSmoothCP(cp, prev, next, path.closed)
        })
        return { ...path, controlPoints: smoothed }
      }),
    }))
    get().regenerateRoads()
  },

  regenerateRoads: () => {
    const { paths, generatedRoadIds } = get()
    const customStore = useCustomizationStore.getState()
    const currentObjects = customStore.placedObjects

    const nonGenerated = currentObjects.filter(o => !generatedRoadIds.has(o.id))

    const allGenerated: PlacedObject[] = []
    for (const path of paths) {
      if (path.controlPoints.length < 2) continue
      const segments = segmentizePath(path)
      allGenerated.push(...segments)
    }

    const newGeneratedIds = new Set(allGenerated.map(r => r.id))

    customStore.setPlacedObjects([...nonGenerated, ...allGenerated])
    set({ generatedRoadIds: newGeneratedIds })

    customStore.saveToStorage()
  },

  importFromPlacedObjects: () => {
    const customStore = useCustomizationStore.getState()
    const roads = customStore.placedObjects.filter(o => o.type === 'road')

    if (roads.length === 0) return null

    const mainRoads = roads.filter(
      r => r.trackMode !== 'pitroad' && r.trackMode !== 'pitroad-curve',
    )
    const pitRoads = roads.filter(r => r.trackMode === 'pitroad' || r.trackMode === 'pitroad-curve')

    const newPaths: TrackPath[] = []

    if (mainRoads.length > 0) {
      newPaths.push(importRoadsToTrackPath(mainRoads, 'main'))
    }
    if (pitRoads.length > 0) {
      newPaths.push(importRoadsToTrackPath(pitRoads, 'pit'))
    }

    if (newPaths.length === 0) return null

    set({
      paths: newPaths,
      generatedRoadIds: new Set(roads.map(r => r.id)),
      activePathId: newPaths[0].id,
      editMode: 'edit',
    })

    get().regenerateRoads()

    return newPaths[0].id
  },

  setPaths: paths => {
    set({ paths })
    get().regenerateRoads()
  },

  getPathById: pathId => {
    return get().paths.find(p => p.id === pathId)
  },
}))
