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

interface ChainStep {
  wayIdx: number
  reverse: boolean
}

function chainBySharedNodes(ways: OSMWay[], startIdx: number): ChainStep[] {
  const nodeToWays = new Map<number, number[]>()
  for (let i = 0; i < ways.length; i++) {
    const w = ways[i]!
    for (const ep of [w.nodes[0]!, w.nodes[w.nodes.length - 1]!]) {
      if (!nodeToWays.has(ep)) nodeToWays.set(ep, [])
      nodeToWays.get(ep)!.push(i)
    }
  }

  let bestSeq: ChainStep[] = []

  function dfs(currentEndNode: number, used: Set<number>, sequence: ChainStep[]): void {
    if (sequence.length > bestSeq.length) bestSeq = [...sequence]
    const candidates = nodeToWays.get(currentEndNode) ?? []
    for (const nextIdx of candidates) {
      if (used.has(nextIdx)) continue
      const nw = ways[nextIdx]!
      const nFirst = nw.nodes[0]!
      const nLast = nw.nodes[nw.nodes.length - 1]!
      const reverse = nFirst === currentEndNode ? false : nLast === currentEndNode ? true : null
      if (reverse === null) continue
      const newEnd = reverse ? nFirst : nLast
      used.add(nextIdx)
      sequence.push({ wayIdx: nextIdx, reverse })
      dfs(newEnd, used, sequence)
      sequence.pop()
      used.delete(nextIdx)
    }
  }

  for (const reverse of [false, true]) {
    const w = ways[startIdx]!
    const endNode = reverse ? w.nodes[0]! : w.nodes[w.nodes.length - 1]!
    const used = new Set<number>([startIdx])
    const seq: ChainStep[] = [{ wayIdx: startIdx, reverse }]
    dfs(endNode, used, seq)
  }

  return bestSeq
}

function chainByGeoDistance(
  ways: OSMWay[],
  nodes: Map<number, OSMNode>,
  startIdx: number,
  maxGap: number,
): number[] {
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

  const used = new Set<number>([startIdx])
  const orderedNodes: number[] = [...ways[startIdx]!.nodes]
  for (let iter = 0; iter < ways.length * 2; iter++) {
    const lastNodeId = orderedNodes[orderedNodes.length - 1]!
    const lastCoord = getCoord(lastNodeId)
    let bestDist = Infinity
    let bestIdx = -1
    let bestReverse = false
    for (let i = 0; i < ways.length; i++) {
      if (used.has(i)) continue
      const w = ways[i]!
      const dStart = geoDistance(lastCoord, getCoord(w.nodes[0]!))
      const dEnd = geoDistance(lastCoord, getCoord(w.nodes[w.nodes.length - 1]!))
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
    const w = ways[bestIdx]!
    const newNodes = bestReverse ? [...w.nodes].reverse() : [...w.nodes]
    orderedNodes.push(...newNodes.slice(bestDist < 5 ? 1 : 0))
  }
  return orderedNodes
}

function sequenceToNodes(ways: OSMWay[], sequence: ChainStep[]): number[] {
  const orderedNodes: number[] = []
  for (let i = 0; i < sequence.length; i++) {
    const step = sequence[i]!
    const w = ways[step.wayIdx]!
    const wnodes = step.reverse ? [...w.nodes].reverse() : [...w.nodes]
    if (i === 0) orderedNodes.push(...wnodes)
    else orderedNodes.push(...wnodes.slice(1))
  }
  return orderedNodes
}

export function orderWaysByRelationMembers(
  ways: OSMWay[],
  memberWayIds: number[],
): number[] | null {
  const wayById = new Map<number, OSMWay>()
  for (const w of ways) wayById.set(w.id, w)
  const orderedWays: OSMWay[] = []
  for (const id of memberWayIds) {
    const w = wayById.get(id)
    if (w) orderedWays.push(w)
  }
  if (orderedWays.length < 2) return null

  let result: number[] | null = null
  let bestUnmatched = Infinity

  for (const startReverse of [false, true]) {
    const trial: number[] = []
    let lastEnd: number | null = null
    let unmatched = 0
    for (let i = 0; i < orderedWays.length; i++) {
      const w = orderedWays[i]!
      const nFirst = w.nodes[0]!
      const nLast = w.nodes[w.nodes.length - 1]!
      let reverse = i === 0 ? startReverse : false
      if (i > 0 && lastEnd != null) {
        if (nFirst === lastEnd) reverse = false
        else if (nLast === lastEnd) reverse = true
        else {
          unmatched++
          continue
        }
      }
      const nodes = reverse ? [...w.nodes].reverse() : [...w.nodes]
      if (trial.length === 0) trial.push(...nodes)
      else trial.push(...(nodes[0] === lastEnd ? nodes.slice(1) : nodes))
      lastEnd = reverse ? nFirst : nLast
    }
    if (unmatched < bestUnmatched) {
      bestUnmatched = unmatched
      result = trial
    }
  }

  if (!result) return null
  if (bestUnmatched > orderedWays.length * 0.2) return null
  return result
}

export function orderWaysIntoCircuit(
  ways: OSMWay[],
  nodes: Map<number, OSMNode>,
  startWayName?: string,
  maxGap: number = 100,
): number[] {
  if (ways.length === 0) return []

  let startIdx = 0
  if (startWayName) {
    const idx = ways.findIndex(w => (w.tags?.name || '') === startWayName)
    if (idx !== -1) startIdx = idx
  }

  const dfsSeq = chainBySharedNodes(ways, startIdx)
  const dfsNodes = sequenceToNodes(ways, dfsSeq)
  const greedyNodes = chainByGeoDistance(ways, nodes, startIdx, maxGap)

  const useDfs = dfsSeq.length >= 0.6 * ways.length && dfsNodes.length >= greedyNodes.length * 0.85

  if (useDfs) {
    console.log(`  🔗 Chained ${dfsSeq.length}/${ways.length} ways via shared-node DFS`)
    return dfsNodes
  }
  console.log(`  🔗 Chained via geo-distance greedy (DFS: ${dfsSeq.length}/${ways.length})`)
  return greedyNodes
}
