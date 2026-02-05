import { create } from 'zustand'
import type { TrackGraph } from '../types/trackGraph'
import type { SnapPointWithDirection } from '../types/trackObjects'
import { buildFromObjects, findBranchPoints, isCircuit, findConnectedRoads } from '../utils/trackGraph'
import { getSnapPoints, findNearestSnapPoint } from '../utils/roadGeometry'
import { useCustomizationStore } from './useCustomizationStore'

interface TrackGraphState {
  graph: TrackGraph
  snapPoints: SnapPointWithDirection[]

  rebuildGraph: () => void
  findNearestSnap: (pos: [number, number, number]) => SnapPointWithDirection | null
  getBranchPoints: () => string[]
  checkCircuit: (startNodeKey?: string) => ReturnType<typeof isCircuit>
  getConnectedRoads: (roadId: string) => string[]
}

export const useTrackGraphStore = create<TrackGraphState>((set, get) => ({
  graph: { nodes: new Map(), edges: new Map(), adjacency: new Map() },
  snapPoints: [],

  rebuildGraph: () => {
    const { placedObjects } = useCustomizationStore.getState()
    const graph = buildFromObjects(placedObjects)
    const snapPoints = getSnapPoints(placedObjects)
    set({ graph, snapPoints })
  },

  findNearestSnap: (pos) => {
    return findNearestSnapPoint(pos, get().snapPoints)
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
}))

let prevObjectsRef: unknown = null
useCustomizationStore.subscribe((state) => {
  if (state.placedObjects !== prevObjectsRef) {
    prevObjectsRef = state.placedObjects
    useTrackGraphStore.getState().rebuildGraph()
  }
})
