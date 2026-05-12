import type { OSMNode, OSMWay } from './overpass'

const METERS_PER_DEG_LAT = 110540

export interface Point2D {
  x: number
  z: number
}

export function gpsToWorld(lat: number, lon: number, centerLat: number, centerLon: number): Point2D {
  const x = (lon - centerLon) * Math.cos((centerLat * Math.PI) / 180) * 111320
  const z = -(lat - centerLat) * METERS_PER_DEG_LAT
  return { x, z }
}

export function orderWaysIntoCircuit(
  ways: OSMWay[],
  nodes: Map<number, OSMNode>,
  startWayName?: string,
  maxGap: number = 100,
): number[] {
  if (ways.length === 0) return []

  function getCoord(nodeId: number): [number, number] | null {
    const n = nodes.get(nodeId)
    return n ? [n.lat, n.lon] : null
  }

  function geoDistance(a: [number, number] | null, b: [number, number] | null): number {
    if (!a || !b) return Infinity
    const dlat = (a[0] - b[0]) * METERS_PER_DEG_LAT
    const dlon = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180) * 111320
    return Math.sqrt(dlat * dlat + dlon * dlon)
  }

  let startIdx = 0
  if (startWayName) {
    const idx = ways.findIndex(w => (w.tags?.name || '') === startWayName)
    if (idx !== -1) startIdx = idx
  }

  const used = new Set<number>([startIdx])
  const orderedNodes: number[] = [...ways[startIdx].nodes]

  for (let iter = 0; iter < ways.length * 2; iter++) {
    const lastCoord = getCoord(orderedNodes[orderedNodes.length - 1])
    let bestDist = Infinity
    let bestIdx = -1
    let bestReverse = false

    for (let i = 0; i < ways.length; i++) {
      if (used.has(i)) continue
      const w = ways[i]
      const dStart = geoDistance(lastCoord, getCoord(w.nodes[0]))
      const dEnd = geoDistance(lastCoord, getCoord(w.nodes[w.nodes.length - 1]))

      if (dStart < bestDist) {
        bestDist = dStart
        bestIdx = i
        bestReverse = false
      }
      if (dEnd < bestDist) {
        bestDist = dEnd
        bestIdx = i
        bestReverse = true
      }
    }

    if (bestIdx === -1 || bestDist > maxGap) break

    used.add(bestIdx)
    const w = ways[bestIdx]
    const newNodes = bestReverse ? [...w.nodes].reverse() : [...w.nodes]
    orderedNodes.push(...newNodes.slice(bestDist < 5 ? 1 : 0))
  }

  console.log(`  🔗 Chained ${used.size}/${ways.length} ways`)
  return orderedNodes
}
