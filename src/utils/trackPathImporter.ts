import type { PlacedObject } from '@/types/trackObjects'
import type { TrackPath, TrackPathControlPoint } from '@/types/trackPath'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { PIT_ROAD_WIDTH } from '@/constants/trackObjects'
import { catmullRomToHandles } from './trackPathInterpolation'

const SNAP_THRESHOLD = 5

function distance2D(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2)
}

function findChainOrder(roads: PlacedObject[]): PlacedObject[] {
  if (roads.length === 0) return []
  if (roads.length === 1) return roads

  const used = new Set<string>()
  const chain: PlacedObject[] = []

  let current = roads[0]
  chain.push(current)
  used.add(current.id)

  for (let iter = 0; iter < roads.length; iter++) {
    const ep = current.endPoint
    if (!ep) break

    let found = false
    for (const road of roads) {
      if (used.has(road.id) || !road.startPoint) continue

      if (distance2D(ep, road.startPoint) < SNAP_THRESHOLD) {
        chain.push(road)
        used.add(road.id)
        current = road
        found = true
        break
      }
    }

    if (!found) {
      for (const road of roads) {
        if (used.has(road.id) || !road.endPoint) continue

        if (distance2D(ep, road.endPoint) < SNAP_THRESHOLD) {
          const reversed: PlacedObject = {
            ...road,
            startPoint: road.endPoint,
            endPoint: road.startPoint,
            startLeftEdge: road.endLeftEdge,
            startRightEdge: road.endRightEdge,
            endLeftEdge: road.startLeftEdge,
            endRightEdge: road.startRightEdge,
            startElevation: road.endElevation,
            endElevation: road.startElevation,
          }
          chain.push(reversed)
          used.add(road.id)
          current = reversed
          found = true
          break
        }
      }
    }

    if (!found) break
  }

  if (chain.length < roads.length) {
    let startRoad = chain[0]
    if (!startRoad.startPoint) return chain

    for (let iter = 0; iter < roads.length - chain.length; iter++) {
      let found = false
      for (const road of roads) {
        if (used.has(road.id)) continue

        if (road.endPoint && distance2D(startRoad.startPoint!, road.endPoint) < SNAP_THRESHOLD) {
          chain.unshift(road)
          used.add(road.id)
          startRoad = road
          found = true
          break
        }

        if (
          road.startPoint &&
          distance2D(startRoad.startPoint!, road.startPoint) < SNAP_THRESHOLD
        ) {
          const reversed: PlacedObject = {
            ...road,
            startPoint: road.endPoint,
            endPoint: road.startPoint,
            startLeftEdge: road.endLeftEdge,
            startRightEdge: road.endRightEdge,
            endLeftEdge: road.startLeftEdge,
            endRightEdge: road.startRightEdge,
            startElevation: road.endElevation,
            endElevation: road.startElevation,
          }
          chain.unshift(reversed)
          used.add(road.id)
          startRoad = reversed
          found = true
          break
        }
      }
      if (!found) break
    }
  }

  return chain
}

let importCounter = 0

export function importRoadsToTrackPath(
  roads: PlacedObject[],
  pathType: 'main' | 'pit' = 'main',
): TrackPath {
  const filtered = roads.filter(r => r.type === 'road' && r.startPoint && r.endPoint)

  const chain = findChainOrder(filtered)
  if (chain.length === 0) {
    return {
      id: `imported_${++importCounter}`,
      name: 'Imported Path',
      type: pathType,
      closed: false,
      width: pathType === 'pit' ? PIT_ROAD_WIDTH : TRACK_WIDTH,
      controlPoints: [],
    }
  }

  const first = chain[0]
  const last = chain[chain.length - 1]
  const isClosed =
    first.startPoint &&
    last.endPoint &&
    distance2D(first.startPoint, last.endPoint) < SNAP_THRESHOLD

  const positions: [number, number][] = []
  const elevations: number[] = []

  for (let i = 0; i < chain.length; i++) {
    const road = chain[i]
    if (!road.startPoint) continue

    positions.push([road.startPoint[0], road.startPoint[2]])
    elevations.push(road.startElevation ?? 0)
  }

  if (!isClosed && last.endPoint) {
    positions.push([last.endPoint[0], last.endPoint[2]])
    elevations.push(last.endElevation ?? 0)
  }

  const controlPoints: TrackPathControlPoint[] = positions.map((pos, i) => {
    const prev = i > 0 ? positions[i - 1] : isClosed ? positions[positions.length - 1] : null
    const next = i < positions.length - 1 ? positions[i + 1] : isClosed ? positions[0] : null

    const handles = catmullRomToHandles(prev, pos, next, 0.3)

    return {
      id: `cp_${i}`,
      position: pos,
      elevation: elevations[i],
      handleIn: handles.handleIn,
      handleOut: handles.handleOut,
    }
  })

  return {
    id: `imported_${++importCounter}`,
    name: pathType === 'pit' ? 'Imported Pit Lane' : 'Imported Circuit',
    type: pathType,
    closed: !!isClosed,
    width: pathType === 'pit' ? PIT_ROAD_WIDTH : TRACK_WIDTH,
    controlPoints,
  }
}
