import { create } from 'zustand'
import type { TrackGraph } from '../types/trackGraph'
import type { SnapPointWithDirection, PlacedObject } from '../types/trackObjects'
import { buildFromObjects, findBranchPoints, isCircuit, findConnectedRoads, propagateFlowDirection, type FlowPropagationResult } from '../utils/trackGraph'
import { getSnapPoints } from '../utils/roadGeometry'
import { SpatialIndex } from '../utils/spatialIndex'
import { useCustomizationStore } from './useCustomizationStore'

interface TrackGraphState {
  graph: TrackGraph
  snapPoints: SnapPointWithDirection[]
  spatialIndex: SpatialIndex
  flowDirections: Map<string, 'forward' | 'backward'>
  flowWarnings: string[]
  hasFlow: boolean

  rebuildGraph: () => void
  findNearestSnap: (pos: [number, number, number]) => SnapPointWithDirection | null
  getBranchPoints: () => string[]
  checkCircuit: (startNodeKey?: string) => ReturnType<typeof isCircuit>
  getConnectedRoads: (roadId: string) => string[]
  setTrackFlow: () => FlowPropagationResult | null
  clearTrackFlow: () => void
  getFlowDirection: (roadId: string) => 'forward' | 'backward' | null
  flipRoadDirection: (roadIds: string[]) => void
}

export const useTrackGraphStore = create<TrackGraphState>((set, get) => ({
  graph: { nodes: new Map(), edges: new Map(), adjacency: new Map() },
  snapPoints: [],
  spatialIndex: new SpatialIndex(),
  flowDirections: new Map(),
  flowWarnings: [],
  hasFlow: false,

  rebuildGraph: () => {
    const { placedObjects } = useCustomizationStore.getState()
    const graph = buildFromObjects(placedObjects)
    const snapPoints = getSnapPoints(placedObjects)
    const spatialIndex = new SpatialIndex()
    spatialIndex.buildFromPoints(snapPoints)
    set({ graph, snapPoints, spatialIndex })
  },

  findNearestSnap: (pos) => {
    return get().spatialIndex.findNearest(pos)
  },

  getBranchPoints: () => {
    return findBranchPoints(get().graph)
  },

  checkCircuit: (startNodeKey?) => {
    return isCircuit(get().graph, startNodeKey)
  },

  getConnectedRoads: (roadId) => {
    return findConnectedRoads(get().graph, roadId)
  },

  setTrackFlow: () => {
    const { placedObjects } = useCustomizationStore.getState()
    const checkpoint = placedObjects.find((o: PlacedObject) => o.type === 'checkpoint')
    if (!checkpoint) return null

    const result = propagateFlowDirection(get().graph, checkpoint, placedObjects)

    const updatedObjects = placedObjects.map((obj: PlacedObject) => {
      if (obj.type === 'road') {
        const dir = result.directions.get(obj.id)
        return { ...obj, flowDirection: dir ?? null }
      }
      return obj
    })
    useCustomizationStore.getState().setPlacedObjects(updatedObjects)

    set({
      flowDirections: result.directions,
      flowWarnings: result.unvisitedRoadIds,
      hasFlow: true,
    })

    return result
  },

  clearTrackFlow: () => {
    const { placedObjects } = useCustomizationStore.getState()
    const updatedObjects = placedObjects.map((obj: PlacedObject) => {
      if (obj.type === 'road' && obj.flowDirection) {
        const { flowDirection: _, ...rest } = obj
        return rest as PlacedObject
      }
      return obj
    })
    useCustomizationStore.getState().setPlacedObjects(updatedObjects)

    set({
      flowDirections: new Map(),
      flowWarnings: [],
      hasFlow: false,
    })
  },

  getFlowDirection: (roadId) => {
    return get().flowDirections.get(roadId) ?? null
  },

  flipRoadDirection: (roadIds) => {
    const { placedObjects } = useCustomizationStore.getState()
    const flowDirections = new Map(get().flowDirections)

    const updatedObjects = placedObjects.map((obj: PlacedObject) => {
      if (obj.type === 'road' && roadIds.includes(obj.id)) {
        const current = flowDirections.get(obj.id)
        if (!current) return obj
        const flipped: 'forward' | 'backward' = current === 'forward' ? 'backward' : 'forward'
        flowDirections.set(obj.id, flipped)
        return { ...obj, flowDirection: flipped }
      }
      return obj
    })

    useCustomizationStore.getState().setPlacedObjects(updatedObjects)
    set({ flowDirections })
  },
}))

let prevObjectsRef: unknown = null
useCustomizationStore.subscribe((state) => {
  if (state.placedObjects !== prevObjectsRef) {
    prevObjectsRef = state.placedObjects
    useTrackGraphStore.getState().rebuildGraph()
  }
})
