import type { PlacedObject, ElevationControlPoint } from '../types/trackObjects'

const SNAP_THRESHOLD = 2

export function getElevationControlPoints(placedObjects: PlacedObject[]): ElevationControlPoint[] {
  const rawPoints: ElevationControlPoint[] = []

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) continue

    rawPoints.push({
      roadId: obj.id,
      road: obj,
      endpoint: 'start',
      worldPosition: [obj.startPoint[0], obj.startElevation ?? 0, obj.startPoint[2]],
      elevation: obj.startElevation ?? 0,
    })

    rawPoints.push({
      roadId: obj.id,
      road: obj,
      endpoint: 'end',
      worldPosition: [obj.endPoint[0], obj.endElevation ?? 0, obj.endPoint[2]],
      elevation: obj.endElevation ?? 0,
    })
  }

  const merged: ElevationControlPoint[] = []
  const used = new Set<number>()

  for (let i = 0; i < rawPoints.length; i++) {
    if (used.has(i)) continue

    const group = [rawPoints[i]]
    used.add(i)

    for (let j = i + 1; j < rawPoints.length; j++) {
      if (used.has(j)) continue
      const dx = rawPoints[i].worldPosition[0] - rawPoints[j].worldPosition[0]
      const dz = rawPoints[i].worldPosition[2] - rawPoints[j].worldPosition[2]
      if (Math.sqrt(dx * dx + dz * dz) < SNAP_THRESHOLD) {
        group.push(rawPoints[j])
        used.add(j)
      }
    }

    let maxElev = -Infinity
    let representative = group[0]
    for (const p of group) {
      if (p.elevation > maxElev) {
        maxElev = p.elevation
        representative = p
      }
    }

    merged.push({
      ...representative,
      worldPosition: [representative.worldPosition[0], maxElev, representative.worldPosition[2]],
      elevation: maxElev,
    })
  }

  return merged
}

export function getConnectedEndpoints(
  roadId: string,
  endpoint: 'start' | 'end',
  placedObjects: PlacedObject[],
): ElevationControlPoint[] {
  const targetRoad = placedObjects.find(o => o.id === roadId)
  if (!targetRoad || !targetRoad.startPoint || !targetRoad.endPoint) return []

  const targetPos = endpoint === 'start' ? targetRoad.startPoint : targetRoad.endPoint
  const connected: ElevationControlPoint[] = []

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) continue

    const dxStart = targetPos[0] - obj.startPoint[0]
    const dzStart = targetPos[2] - obj.startPoint[2]
    if (Math.sqrt(dxStart * dxStart + dzStart * dzStart) < SNAP_THRESHOLD) {
      connected.push({
        roadId: obj.id,
        road: obj,
        endpoint: 'start',
        worldPosition: [obj.startPoint[0], obj.startElevation ?? 0, obj.startPoint[2]],
        elevation: obj.startElevation ?? 0,
      })
    }

    const dxEnd = targetPos[0] - obj.endPoint[0]
    const dzEnd = targetPos[2] - obj.endPoint[2]
    if (Math.sqrt(dxEnd * dxEnd + dzEnd * dzEnd) < SNAP_THRESHOLD) {
      connected.push({
        roadId: obj.id,
        road: obj,
        endpoint: 'end',
        worldPosition: [obj.endPoint[0], obj.endElevation ?? 0, obj.endPoint[2]],
        elevation: obj.endElevation ?? 0,
      })
    }
  }

  return connected
}

export function findRoadPath(
  fromRoadId: string,
  fromEndpoint: 'start' | 'end',
  toRoadId: string,
  toEndpoint: 'start' | 'end',
  placedObjects: PlacedObject[],
): { roadId: string; endpoint: 'start' | 'end' }[] | null {
  const roads = placedObjects.filter(o => o.type === 'road' && o.startPoint && o.endPoint)

  type Node = { roadId: string; endpoint: 'start' | 'end' }
  const nodeKey = (n: Node) => `${n.roadId}:${n.endpoint}`
  const targetKey = nodeKey({ roadId: toRoadId, endpoint: toEndpoint })

  const queue: { node: Node; path: Node[] }[] = [
    { node: { roadId: fromRoadId, endpoint: fromEndpoint }, path: [{ roadId: fromRoadId, endpoint: fromEndpoint }] },
  ]
  const visited = new Set<string>()
  visited.add(nodeKey({ roadId: fromRoadId, endpoint: fromEndpoint }))

  while (queue.length > 0) {
    const { node, path } = queue.shift()!

    const oppositeEndpoint: 'start' | 'end' = node.endpoint === 'start' ? 'end' : 'start'
    const oppositeKey = nodeKey({ roadId: node.roadId, endpoint: oppositeEndpoint })

    if (!visited.has(oppositeKey)) {
      visited.add(oppositeKey)
      const newPath = [...path, { roadId: node.roadId, endpoint: oppositeEndpoint }]

      if (oppositeKey === targetKey) return newPath

      const connected = getConnectedEndpoints(node.roadId, oppositeEndpoint, placedObjects)
      for (const cp of connected) {
        if (cp.roadId === node.roadId) continue
        const cpKey = nodeKey({ roadId: cp.roadId, endpoint: cp.endpoint })
        if (!visited.has(cpKey)) {
          visited.add(cpKey)
          queue.push({
            node: { roadId: cp.roadId, endpoint: cp.endpoint },
            path: [...newPath, { roadId: cp.roadId, endpoint: cp.endpoint }],
          })
        }
      }
    }
  }

  return null
}

export function computeRoadGrade(road: PlacedObject): number {
  if (!road.startPoint || !road.endPoint) return 0
  const startElev = road.startElevation ?? 0
  const endElev = road.endElevation ?? 0
  const elevDiff = Math.abs(endElev - startElev)
  if (elevDiff < 0.01) return 0

  let length: number
  if (road.trackMode === 'curve' && road.controlPoint) {
    let arcLength = 0
    const SAMPLES = 20
    let prevX = road.startPoint[0]
    let prevZ = road.startPoint[2]
    for (let i = 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const t1 = 1 - t
      const x = t1 * t1 * road.startPoint[0] + 2 * t1 * t * road.controlPoint[0] + t * t * road.endPoint[0]
      const z = t1 * t1 * road.startPoint[2] + 2 * t1 * t * road.controlPoint[2] + t * t * road.endPoint[2]
      arcLength += Math.sqrt((x - prevX) ** 2 + (z - prevZ) ** 2)
      prevX = x
      prevZ = z
    }
    length = arcLength
  } else {
    const dx = road.endPoint[0] - road.startPoint[0]
    const dz = road.endPoint[2] - road.startPoint[2]
    length = Math.sqrt(dx * dx + dz * dz)
  }

  if (length < 0.01) return 0
  return (elevDiff / length) * 100
}

export function smoothElevations(
  roadIds: string[],
  placedObjects: PlacedObject[],
  iterations: number = 1,
): Map<string, { startElevation: number; endElevation: number }> {
  const roads = placedObjects.filter(o => roadIds.includes(o.id) && o.type === 'road')
  const result = new Map<string, { startElevation: number; endElevation: number }>()

  for (const road of roads) {
    result.set(road.id, {
      startElevation: road.startElevation ?? 0,
      endElevation: road.endElevation ?? 0,
    })
  }

  for (let iter = 0; iter < iterations; iter++) {
    const snapshot = new Map(result)

    for (const road of roads) {
      const current = snapshot.get(road.id)!

      for (const ep of ['start', 'end'] as const) {
        const currentHeight = ep === 'start' ? current.startElevation : current.endElevation
        const connected = getConnectedEndpoints(road.id, ep, placedObjects)
        if (connected.length <= 1) continue

        let neighborSum = 0
        let neighborCount = 0
        for (const cp of connected) {
          if (cp.roadId === road.id && cp.endpoint === ep) continue
          const cpData = snapshot.get(cp.roadId)
          const cpHeight = cpData
            ? (cp.endpoint === 'start' ? cpData.startElevation : cpData.endElevation)
            : cp.elevation
          neighborSum += cpHeight
          neighborCount++
        }

        if (neighborCount > 0) {
          const avg = neighborSum / neighborCount
          const smoothed = (currentHeight + avg) / 2
          const entry = result.get(road.id)!
          if (ep === 'start') {
            entry.startElevation = Math.round(smoothed / 0.25) * 0.25
          } else {
            entry.endElevation = Math.round(smoothed / 0.25) * 0.25
          }
        }
      }
    }
  }

  return result
}

export function propagateElevation(
  changedRoadId: string,
  changedEndpoint: 'start' | 'end',
  newHeight: number,
  placedObjects: PlacedObject[],
  maxDepth: number = 3,
): { id: string; prop: string; height: number }[] {
  const result: { id: string; prop: string; height: number }[] = []
  const visited = new Set<string>()
  visited.add(`${changedRoadId}:${changedEndpoint}`)

  type QueueItem = { roadId: string; endpoint: 'start' | 'end'; height: number; depth: number }
  const queue: QueueItem[] = [{ roadId: changedRoadId, endpoint: changedEndpoint, height: newHeight, depth: 0 }]

  while (queue.length > 0) {
    const { roadId, endpoint, height, depth } = queue.shift()!

    const oppositeEndpoint: 'start' | 'end' = endpoint === 'start' ? 'end' : 'start'
    const oppositeKey = `${roadId}:${oppositeEndpoint}`
    if (!visited.has(oppositeKey)) {
      visited.add(oppositeKey)
      const road = placedObjects.find(o => o.id === roadId)
      if (road) {
        const currentH = oppositeEndpoint === 'start' ? (road.startElevation ?? 0) : (road.endElevation ?? 0)
        const blended = Math.round(((currentH + height) / 2) / 0.25) * 0.25
        const prop = oppositeEndpoint === 'start' ? 'startElevation' : 'endElevation'
        result.push({ id: roadId, prop, height: blended })

        if (depth + 1 < maxDepth) {
          const connected = getConnectedEndpoints(roadId, oppositeEndpoint, placedObjects)
          for (const cp of connected) {
            const cpKey = `${cp.roadId}:${cp.endpoint}`
            if (!visited.has(cpKey)) {
              visited.add(cpKey)
              const cpProp = cp.endpoint === 'start' ? 'startElevation' : 'endElevation'
              result.push({ id: cp.roadId, prop: cpProp, height: blended })
              queue.push({ roadId: cp.roadId, endpoint: cp.endpoint, height: blended, depth: depth + 1 })
            }
          }
        }
      }
    }

    if (depth < maxDepth) {
      const connected = getConnectedEndpoints(roadId, endpoint, placedObjects)
      for (const cp of connected) {
        const cpKey = `${cp.roadId}:${cp.endpoint}`
        if (!visited.has(cpKey)) {
          visited.add(cpKey)
          const falloff = 1 - (depth + 1) / (maxDepth + 1)
          const blended = Math.round((height * falloff) / 0.25) * 0.25
          const cpProp = cp.endpoint === 'start' ? 'startElevation' : 'endElevation'
          result.push({ id: cp.roadId, prop: cpProp, height: blended })
          queue.push({ roadId: cp.roadId, endpoint: cp.endpoint, height: blended, depth: depth + 1 })
        }
      }
    }
  }

  return result
}
