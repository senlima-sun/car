import type { PlacedObject } from '../types/trackObjects'
import { isLinearObject, isCurveMode } from '../types/trackObjects'
import type { GraphNode, GraphEdge, TrackGraph, CircuitResult } from '../types/trackGraph'
import { positionKey } from '../types/trackGraph'

const SNAP_THRESHOLD = 5

const distance3D = (a: [number, number, number], b: [number, number, number]): number => {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

const sampleBezier = (
  start: [number, number, number],
  control: [number, number, number],
  end: [number, number, number],
  t: number,
): [number, number, number] => {
  const inv = 1 - t
  return [
    inv * inv * start[0] + 2 * inv * t * control[0] + t * t * end[0],
    inv * inv * start[1] + 2 * inv * t * control[1] + t * t * end[1],
    inv * inv * start[2] + 2 * inv * t * control[2] + t * t * end[2],
  ]
}

const approximateCurveLength = (
  start: [number, number, number],
  control: [number, number, number],
  end: [number, number, number],
  samples: number = 20,
): number => {
  let length = 0
  let prev = start
  for (let i = 1; i <= samples; i++) {
    const t = i / samples
    const current = sampleBezier(start, control, end, t)
    length += distance3D(prev, current)
    prev = current
  }
  return length
}

const findMatchingNodeKey = (
  nodes: Map<string, GraphNode>,
  position: [number, number, number],
): string | null => {
  for (const [key, node] of nodes) {
    if (distance3D(node.position, position) < SNAP_THRESHOLD) {
      return key
    }
  }
  return null
}

export const getRoadLength = (road: PlacedObject): number => {
  if (!road.startPoint || !road.endPoint) return 0

  if (isCurveMode(road.trackMode) && road.controlPoint) {
    return approximateCurveLength(road.startPoint, road.controlPoint, road.endPoint)
  }

  return distance3D(road.startPoint, road.endPoint)
}

const resolveNodeKey = (
  nodes: Map<string, GraphNode>,
  position: [number, number, number],
): string => {
  const existing = findMatchingNodeKey(nodes, position)
  if (existing) return existing
  return positionKey(position)
}

const ensureNode = (
  nodes: Map<string, GraphNode>,
  key: string,
  position: [number, number, number],
): void => {
  if (!nodes.has(key)) {
    nodes.set(key, { key, position, edges: [] })
  }
}

const ensureAdjacency = (adjacency: Map<string, Set<string>>, key: string): void => {
  if (!adjacency.has(key)) {
    adjacency.set(key, new Set())
  }
}

export const buildFromObjects = (objects: PlacedObject[]): TrackGraph => {
  const nodes = new Map<string, GraphNode>()
  const edges = new Map<string, GraphEdge>()
  const adjacency = new Map<string, Set<string>>()

  const roads = objects.filter(obj => isLinearObject(obj.type) && obj.startPoint && obj.endPoint)

  for (const road of roads) {
    const startKey = resolveNodeKey(nodes, road.startPoint!)
    const endKey = resolveNodeKey(nodes, road.endPoint!)
    const edgeId = `edge_${road.id}`

    ensureNode(nodes, startKey, road.startPoint!)
    nodes.get(startKey)!.edges.push(edgeId)

    ensureNode(nodes, endKey, road.endPoint!)
    nodes.get(endKey)!.edges.push(edgeId)

    edges.set(edgeId, {
      id: edgeId,
      roadId: road.id,
      startNodeKey: startKey,
      endNodeKey: endKey,
      length: getRoadLength(road),
      flowDirection: null,
      connectionType: 'manual',
    })

    ensureAdjacency(adjacency, startKey)
    ensureAdjacency(adjacency, endKey)
    adjacency.get(startKey)!.add(endKey)
    adjacency.get(endKey)!.add(startKey)
  }

  return { nodes, edges, adjacency }
}

export const addRoad = (graph: TrackGraph, road: PlacedObject): TrackGraph => {
  if (!isLinearObject(road.type) || !road.startPoint || !road.endPoint) {
    return graph
  }

  const nodes = new Map(graph.nodes)
  const edges = new Map(graph.edges)
  const adjacency = new Map<string, Set<string>>()
  for (const [key, set] of graph.adjacency) {
    adjacency.set(key, new Set(set))
  }

  for (const [key, node] of nodes) {
    nodes.set(key, { ...node, edges: [...node.edges] })
  }

  const startKey = resolveNodeKey(nodes, road.startPoint)
  const endKey = resolveNodeKey(nodes, road.endPoint)
  const edgeId = `edge_${road.id}`

  ensureNode(nodes, startKey, road.startPoint)
  nodes.get(startKey)!.edges.push(edgeId)

  ensureNode(nodes, endKey, road.endPoint)
  nodes.get(endKey)!.edges.push(edgeId)

  edges.set(edgeId, {
    id: edgeId,
    roadId: road.id,
    startNodeKey: startKey,
    endNodeKey: endKey,
    length: getRoadLength(road),
    flowDirection: null,
    connectionType: 'manual',
  })

  ensureAdjacency(adjacency, startKey)
  ensureAdjacency(adjacency, endKey)
  adjacency.get(startKey)!.add(endKey)
  adjacency.get(endKey)!.add(startKey)

  return { nodes, edges, adjacency }
}

export const removeRoad = (graph: TrackGraph, roadId: string): TrackGraph => {
  const edgeId = `edge_${roadId}`
  const edge = graph.edges.get(edgeId)
  if (!edge) return graph

  const nodes = new Map(graph.nodes)
  const edges = new Map(graph.edges)
  const adjacency = new Map<string, Set<string>>()
  for (const [key, set] of graph.adjacency) {
    adjacency.set(key, new Set(set))
  }

  for (const [key, node] of nodes) {
    nodes.set(key, { ...node, edges: [...node.edges] })
  }

  edges.delete(edgeId)

  const { startNodeKey, endNodeKey } = edge

  const startNode = nodes.get(startNodeKey)
  if (startNode) {
    startNode.edges = startNode.edges.filter(e => e !== edgeId)
    if (startNode.edges.length === 0) {
      nodes.delete(startNodeKey)
      adjacency.delete(startNodeKey)
      for (const [, set] of adjacency) {
        set.delete(startNodeKey)
      }
    }
  }

  const endNode = nodes.get(endNodeKey)
  if (endNode) {
    endNode.edges = endNode.edges.filter(e => e !== edgeId)
    if (endNode.edges.length === 0) {
      nodes.delete(endNodeKey)
      adjacency.delete(endNodeKey)
      for (const [, set] of adjacency) {
        set.delete(endNodeKey)
      }
    }
  }

  if (nodes.has(startNodeKey) && nodes.has(endNodeKey)) {
    let stillConnected = false
    for (const [, e] of edges) {
      if (
        (e.startNodeKey === startNodeKey && e.endNodeKey === endNodeKey) ||
        (e.startNodeKey === endNodeKey && e.endNodeKey === startNodeKey)
      ) {
        stillConnected = true
        break
      }
    }
    if (!stillConnected) {
      adjacency.get(startNodeKey)?.delete(endNodeKey)
      adjacency.get(endNodeKey)?.delete(startNodeKey)
    }
  }

  return { nodes, edges, adjacency }
}

export const findConnectedRoads = (graph: TrackGraph, roadId: string): string[] => {
  const edgeId = `edge_${roadId}`
  const edge = graph.edges.get(edgeId)
  if (!edge) return []

  const visitedNodes = new Set<string>()
  const visitedEdges = new Set<string>()
  const queue: string[] = [edge.startNodeKey, edge.endNodeKey]

  while (queue.length > 0) {
    const nodeKey = queue.shift()!
    if (visitedNodes.has(nodeKey)) continue
    visitedNodes.add(nodeKey)

    const node = graph.nodes.get(nodeKey)
    if (!node) continue

    for (const eId of node.edges) {
      if (visitedEdges.has(eId)) continue
      visitedEdges.add(eId)

      const e = graph.edges.get(eId)
      if (!e) continue

      const otherKey = e.startNodeKey === nodeKey ? e.endNodeKey : e.startNodeKey
      if (!visitedNodes.has(otherKey)) {
        queue.push(otherKey)
      }
    }
  }

  return Array.from(visitedEdges).map(eId => graph.edges.get(eId)!.roadId)
}

export const isCircuit = (graph: TrackGraph, startNodeKey?: string): CircuitResult => {
  if (graph.nodes.size === 0) {
    return { isClosed: false, gapLocations: [], danglingBranches: [], pathLengths: [] }
  }

  const firstKey = startNodeKey || graph.nodes.keys().next().value!
  if (!graph.nodes.has(firstKey)) {
    return { isClosed: false, gapLocations: [], danglingBranches: [], pathLengths: [] }
  }

  const visitedNodes = new Set<string>()
  const queue: string[] = [firstKey]
  const gapLocations: [number, number, number][] = []
  const danglingBranches: string[] = []
  const pathLengths: number[] = []

  while (queue.length > 0) {
    const nodeKey = queue.shift()!
    if (visitedNodes.has(nodeKey)) continue
    visitedNodes.add(nodeKey)

    const neighbors = graph.adjacency.get(nodeKey)
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visitedNodes.has(neighbor)) {
          queue.push(neighbor)
        }
      }
    }
  }

  let totalLength = 0
  const componentEdges = new Set<string>()
  for (const nodeKey of visitedNodes) {
    const node = graph.nodes.get(nodeKey)
    if (!node) continue
    for (const eId of node.edges) {
      if (!componentEdges.has(eId)) {
        componentEdges.add(eId)
        const e = graph.edges.get(eId)
        if (e) totalLength += e.length
      }
    }
  }
  if (totalLength > 0) pathLengths.push(totalLength)

  for (const nodeKey of visitedNodes) {
    const node = graph.nodes.get(nodeKey)
    if (!node) continue
    const degree = node.edges.length
    if (degree === 1) {
      gapLocations.push(node.position)
      danglingBranches.push(nodeKey)
    }
  }

  const isClosed = gapLocations.length === 0 && visitedNodes.size > 0

  return { isClosed, gapLocations, danglingBranches, pathLengths }
}

export const getAllPaths = (graph: TrackGraph, startKey: string, endKey: string): string[][] => {
  const MAX_DEPTH = 50
  const results: string[][] = []

  if (!graph.nodes.has(startKey) || !graph.nodes.has(endKey)) {
    return results
  }

  const dfs = (
    currentKey: string,
    visitedEdges: Set<string>,
    path: string[],
    depth: number,
  ): void => {
    if (depth > MAX_DEPTH) return
    if (currentKey === endKey && path.length > 0) {
      results.push([...path])
      return
    }

    const node = graph.nodes.get(currentKey)
    if (!node) return

    for (const edgeId of node.edges) {
      if (visitedEdges.has(edgeId)) continue

      const edge = graph.edges.get(edgeId)
      if (!edge) continue

      const nextKey = edge.startNodeKey === currentKey ? edge.endNodeKey : edge.startNodeKey
      visitedEdges.add(edgeId)
      path.push(edgeId)
      dfs(nextKey, visitedEdges, path, depth + 1)
      path.pop()
      visitedEdges.delete(edgeId)
    }
  }

  dfs(startKey, new Set(), [], 0)
  return results
}

export const getAdjacentRoads = (graph: TrackGraph, roadId: string): string[] => {
  const edgeId = `edge_${roadId}`
  const edge = graph.edges.get(edgeId)
  if (!edge) return []

  const adjacentRoadIds = new Set<string>()
  const nodeKeys = [edge.startNodeKey, edge.endNodeKey]

  for (const nodeKey of nodeKeys) {
    const node = graph.nodes.get(nodeKey)
    if (!node) continue

    for (const eId of node.edges) {
      if (eId === edgeId) continue
      const e = graph.edges.get(eId)
      if (e) adjacentRoadIds.add(e.roadId)
    }
  }

  return Array.from(adjacentRoadIds)
}

export const findBranchPoints = (graph: TrackGraph): string[] => {
  const branchPoints: string[] = []

  for (const [key, node] of graph.nodes) {
    if (node.edges.length > 2) {
      branchPoints.push(key)
    }
  }

  return branchPoints
}

export interface FlowPropagationResult {
  directions: Map<string, 'forward' | 'backward'>
  unvisitedRoadIds: string[]
}

export interface DirectionIssue {
  type: 'discontinuity' | 'isolated'
  roadId: string
  position: [number, number, number]
  message: string
}

export interface DirectionValidationResult {
  valid: boolean
  issues: DirectionIssue[]
}

export const validateFlowDirections = (
  graph: TrackGraph,
  objects: PlacedObject[],
): DirectionValidationResult => {
  const issues: DirectionIssue[] = []
  const roadMap = new Map(objects.filter(o => o.type === 'road').map(o => [o.id, o]))

  for (const [, edge] of graph.edges) {
    const road = roadMap.get(edge.roadId)
    if (!road || !road.flowDirection) continue

    const nodeKeys = [edge.startNodeKey, edge.endNodeKey]
    for (const nodeKey of nodeKeys) {
      const node = graph.nodes.get(nodeKey)
      if (!node) continue

      for (const neighborEdgeId of node.edges) {
        if (neighborEdgeId === edge.id) continue
        const neighborEdge = graph.edges.get(neighborEdgeId)
        if (!neighborEdge) continue
        const neighborRoad = roadMap.get(neighborEdge.roadId)
        if (!neighborRoad || !neighborRoad.flowDirection) continue

        const currentExitsAtNode =
          (road.flowDirection === 'forward' && edge.endNodeKey === nodeKey) ||
          (road.flowDirection === 'backward' && edge.startNodeKey === nodeKey)

        const neighborEntersAtNode =
          (neighborRoad.flowDirection === 'forward' && neighborEdge.startNodeKey === nodeKey) ||
          (neighborRoad.flowDirection === 'backward' && neighborEdge.endNodeKey === nodeKey)

        if (currentExitsAtNode && !neighborEntersAtNode) {
          const alreadyReported = issues.some(
            i =>
              i.type === 'discontinuity' &&
              i.position[0] === node.position[0] &&
              i.position[2] === node.position[2],
          )
          if (!alreadyReported) {
            issues.push({
              type: 'discontinuity',
              roadId: road.id,
              position: node.position,
              message: 'Direction discontinuity at junction',
            })
          }
        }
      }
    }
  }

  for (const [, road] of roadMap) {
    if (!road.flowDirection) {
      const edgeId = `edge_${road.id}`
      const edge = graph.edges.get(edgeId)
      const pos: [number, number, number] = edge
        ? (graph.nodes.get(edge.startNodeKey)?.position ?? [0, 0, 0])
        : road.position
      issues.push({
        type: 'isolated',
        roadId: road.id,
        position: pos,
        message: 'Road has no flow direction assigned',
      })
    }
  }

  return { valid: issues.length === 0, issues }
}

export const propagateFlowDirection = (
  graph: TrackGraph,
  checkpoint: PlacedObject,
  objects: PlacedObject[],
): FlowPropagationResult => {
  const directions = new Map<string, 'forward' | 'backward'>()
  const allRoadEdgeIds = new Set<string>()

  for (const [edgeId, edge] of graph.edges) {
    const road = objects.find(o => o.id === edge.roadId)
    if (road && road.type === 'road') {
      allRoadEdgeIds.add(edgeId)
    }
  }

  if (!checkpoint.startPoint || !checkpoint.endPoint || allRoadEdgeIds.size === 0) {
    return {
      directions,
      unvisitedRoadIds: Array.from(allRoadEdgeIds).map(eId => graph.edges.get(eId)!.roadId),
    }
  }

  const checkpointCenter: [number, number, number] = [
    (checkpoint.startPoint[0] + checkpoint.endPoint[0]) / 2,
    0,
    (checkpoint.startPoint[2] + checkpoint.endPoint[2]) / 2,
  ]

  const checkpointNormal: [number, number] = [
    Math.sin(checkpoint.rotation),
    Math.cos(checkpoint.rotation),
  ]

  let closestEdgeId: string | null = null
  let closestDist = Infinity
  for (const edgeId of allRoadEdgeIds) {
    const edge = graph.edges.get(edgeId)!
    const startNode = graph.nodes.get(edge.startNodeKey)
    const endNode = graph.nodes.get(edge.endNodeKey)
    if (!startNode || !endNode) continue

    const midX = (startNode.position[0] + endNode.position[0]) / 2
    const midZ = (startNode.position[2] + endNode.position[2]) / 2
    const dist = Math.sqrt((midX - checkpointCenter[0]) ** 2 + (midZ - checkpointCenter[2]) ** 2)
    if (dist < closestDist) {
      closestDist = dist
      closestEdgeId = edgeId
    }
  }

  if (!closestEdgeId) {
    return {
      directions,
      unvisitedRoadIds: Array.from(allRoadEdgeIds).map(eId => graph.edges.get(eId)!.roadId),
    }
  }

  const startEdge = graph.edges.get(closestEdgeId)!
  const startNode = graph.nodes.get(startEdge.startNodeKey)!
  const endNode = graph.nodes.get(startEdge.endNodeKey)!

  const roadDirX = endNode.position[0] - startNode.position[0]
  const roadDirZ = endNode.position[2] - startNode.position[2]
  const dot = roadDirX * checkpointNormal[0] + roadDirZ * checkpointNormal[1]
  const initialDirection: 'forward' | 'backward' = dot >= 0 ? 'forward' : 'backward'

  directions.set(startEdge.roadId, initialDirection)

  const visitedEdges = new Set<string>([closestEdgeId])
  const queue: Array<{ nodeKey: string; incomingEdgeId: string }> = []

  const entryNodeKey =
    initialDirection === 'forward' ? startEdge.endNodeKey : startEdge.startNodeKey
  const exitNodeKey = initialDirection === 'forward' ? startEdge.startNodeKey : startEdge.endNodeKey

  queue.push({ nodeKey: entryNodeKey, incomingEdgeId: closestEdgeId })
  queue.push({ nodeKey: exitNodeKey, incomingEdgeId: closestEdgeId })

  while (queue.length > 0) {
    const { nodeKey, incomingEdgeId } = queue.shift()!
    const node = graph.nodes.get(nodeKey)
    if (!node) continue

    const incomingEdge = graph.edges.get(incomingEdgeId)!
    const incomingDir = directions.get(incomingEdge.roadId)!
    const arrivedFromStart =
      (incomingDir === 'forward' && incomingEdge.endNodeKey === nodeKey) ||
      (incomingDir === 'backward' && incomingEdge.startNodeKey === nodeKey)

    for (const edgeId of node.edges) {
      if (visitedEdges.has(edgeId)) continue
      if (!allRoadEdgeIds.has(edgeId)) continue
      visitedEdges.add(edgeId)

      const edge = graph.edges.get(edgeId)!
      let dir: 'forward' | 'backward'

      if (arrivedFromStart) {
        dir = edge.startNodeKey === nodeKey ? 'forward' : 'backward'
      } else {
        dir = edge.startNodeKey === nodeKey ? 'forward' : 'backward'
      }

      directions.set(edge.roadId, dir)

      const nextNodeKey = edge.startNodeKey === nodeKey ? edge.endNodeKey : edge.startNodeKey
      queue.push({ nodeKey: nextNodeKey, incomingEdgeId: edgeId })
    }
  }

  const unvisitedRoadIds: string[] = []
  for (const edgeId of allRoadEdgeIds) {
    if (!visitedEdges.has(edgeId)) {
      unvisitedRoadIds.push(graph.edges.get(edgeId)!.roadId)
    }
  }

  return { directions, unvisitedRoadIds }
}
