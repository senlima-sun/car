export interface GraphNode {
  key: string
  position: [number, number, number]
  edges: string[]
}

export interface GraphEdge {
  id: string
  roadId: string
  startNodeKey: string
  endNodeKey: string
  length: number
  flowDirection: 'forward' | 'backward' | null
  connectionType: 'snap' | 'manual'
}

export interface TrackGraph {
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>
  adjacency: Map<string, Set<string>>
}

export interface CircuitResult {
  isClosed: boolean
  gapLocations: [number, number, number][]
  danglingBranches: string[]
  pathLengths: number[]
}

export interface ConnectivityResult {
  mainCircuit: string[]
  orphanRoads: string[]
  connectedComponents: string[][]
}

export const positionKey = (pos: [number, number, number], precision: number = 1): string => {
  return `${Math.round(pos[0] * precision) / precision},${Math.round(pos[2] * precision) / precision}`
}
