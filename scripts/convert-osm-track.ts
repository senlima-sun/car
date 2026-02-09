#!/usr/bin/env bun
/**
 * OSM Track Data Converter
 *
 * Fetches F1 circuit data from OpenStreetMap Overpass API,
 * converts GPS coordinates to game world coordinates,
 * and outputs PlacedObject[] JSON compatible with the track editor.
 *
 * Usage: bun run scripts/convert-osm-track.ts <circuit-name>
 *   e.g. bun run scripts/convert-osm-track.ts silverstone
 *        bun run scripts/convert-osm-track.ts suzuka
 */

// ============================================================================
// Types
// ============================================================================

interface OSMNode {
  type: 'node'
  id: number
  lat: number
  lon: number
}

interface OSMWay {
  type: 'way'
  id: number
  nodes: number[]
  tags: Record<string, string>
}

interface OSMResponse {
  elements: (OSMNode | OSMWay)[]
}

interface Point2D {
  x: number
  z: number
}

interface PlacedObject {
  id: string
  type: 'road' | 'curb' | 'barrier' | 'checkpoint' | 'cone'
  position: [number, number, number]
  rotation: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  controlPoint?: [number, number, number]
  trackMode?: 'straight' | 'curve'
  startLeftEdge?: [number, number, number]
  startRightEdge?: [number, number, number]
  endLeftEdge?: [number, number, number]
  endRightEdge?: [number, number, number]
  checkpointType?: 'start-finish' | 'sector'
  checkpointOrder?: number
  width?: number
  startElevation?: number
  endElevation?: number
}

interface CircuitConfig {
  name: string
  displayName: string
  query: string
  centerLat: number
  centerLon: number
  /** Filter function to select only GP circuit ways */
  filterWays?: (way: OSMWay) => boolean
  /** Way name to start chaining from */
  startWayName?: string
  /** Max gap (meters) allowed between chained ways */
  maxChainGap?: number
  /** Elevation overrides: segments where elevation != 0 */
  elevationZones?: { startFraction: number; endFraction: number; elevation: number }[]
  /** Sector split fractions [0-1] for checkpoint placement */
  sectorSplits: [number, number]
  /** Start/finish line fraction [0-1] */
  startFinishFraction: number
}

// ============================================================================
// Circuit Configurations
// ============================================================================

const CIRCUITS: Record<string, CircuitConfig> = {
  silverstone: {
    name: 'silverstone',
    displayName: 'Silverstone Circuit',
    query: `[out:json][timeout:60];
      (
        way(52.05,-1.05,52.09,-0.98)["highway"="raceway"]["sport"="motor"];
      );
      out body;
      >;
      out skel qt;`,
    centerLat: 52.0716,
    centerLon: -1.0166,
    // Silverstone GP circuit named sections in order
    filterWays: (way: OSMWay) => {
      const name = way.tags?.name || ''
      // Exclude non-GP circuit ways
      const excludePatterns = ['Stowe Circuit', 'Stowe CircuitPit', 'Stowe Circuit Pit', 'International pit lane', 'Ice Hill']
      if (excludePatterns.some(e => name.includes(e))) return false
      return true
    },
    /** Way name to start chaining from */
    startWayName: 'National Pit Straight',
    sectorSplits: [0.33, 0.66],
    startFinishFraction: 0.0,
  },
  suzuka: {
    name: 'suzuka',
    displayName: 'Suzuka International Racing Course',
    query: `[out:json][timeout:60];
      (
        way(34.83,136.52,34.86,136.55)["highway"="raceway"]["sport"="motor"];
      );
      out body;
      >;
      out skel qt;`,
    centerLat: 34.8431,
    centerLon: 136.5407,
    filterWays: (way: OSMWay) => {
      const name = way.tags?.name || ''
      const excludePatterns = [
        'Pit Lane', 'West Circuit Pit Lane', '鈴鹿サーキット国際南コース',
        'プッチグランプリ', 'DREAM R', 'アクロエックス', 'ene-1',
        'ロッキーコースター', 'チララのフラワーワゴン', 'アドベンチャードライブ',
        '日立オートモティブシステムズシケイン', // old naming, duplicates 日立Astemo
      ]
      if (excludePatterns.some(e => name.includes(e))) return false
      return true
    },
    startWayName: 'メインストレート',
    maxChainGap: 50,
    // Suzuka overpass: back straight passes over the S-curves section
    elevationZones: [
      // The overpass section (roughly where the back straight crosses over)
      { startFraction: 0.55, endFraction: 0.62, elevation: 6.0 },
    ],
    sectorSplits: [0.33, 0.66],
    startFinishFraction: 0.0,
  },
}

// ============================================================================
// Constants
// ============================================================================

const TRACK_WIDTH = 12
const HALF_WIDTH = TRACK_WIDTH / 2
const METERS_PER_DEG_LAT = 110540
const SIMPLIFY_TOLERANCE = 1.0 // meters - Douglas-Peucker tolerance
const MAX_SEGMENT_LENGTH = 60 // meters - max road segment length
const CURVATURE_THRESHOLD = 0.005 // threshold to use curve vs straight

// ============================================================================
// GPS → Game World Conversion
// ============================================================================

function gpsToWorld(lat: number, lon: number, centerLat: number, centerLon: number): Point2D {
  const x = (lon - centerLon) * Math.cos(centerLat * Math.PI / 180) * 111320
  const z = -(lat - centerLat) * METERS_PER_DEG_LAT // negate so north = -z
  return { x, z }
}

// ============================================================================
// Douglas-Peucker Line Simplification
// ============================================================================

function perpendicularDistance(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x
  const dz = lineEnd.z - lineStart.z
  const lineLenSq = dx * dx + dz * dz
  if (lineLenSq === 0) {
    const ddx = point.x - lineStart.x
    const ddz = point.z - lineStart.z
    return Math.sqrt(ddx * ddx + ddz * ddz)
  }
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / lineLenSq))
  const projX = lineStart.x + t * dx
  const projZ = lineStart.z + t * dz
  const ddx = point.x - projX
  const ddz = point.z - projZ
  return Math.sqrt(ddx * ddx + ddz * ddz)
}

function douglasPeucker(points: Point2D[], tolerance: number): Point2D[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0
  const end = points.length - 1

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end])
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[end]]
}

// ============================================================================
// Curvature Analysis
// ============================================================================

function computeCurvature(p0: Point2D, p1: Point2D, p2: Point2D): number {
  // Menger curvature: 4 * area / (|p0-p1| * |p1-p2| * |p2-p0|)
  const area = Math.abs((p1.x - p0.x) * (p2.z - p0.z) - (p2.x - p0.x) * (p1.z - p0.z)) / 2
  const d01 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2)
  const d12 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.z - p1.z) ** 2)
  const d02 = Math.sqrt((p2.x - p0.x) ** 2 + (p2.z - p0.z) ** 2)
  const denom = d01 * d12 * d02
  if (denom < 0.001) return 0
  return (4 * area) / denom
}

// ============================================================================
// Bézier Curve Fitting
// ============================================================================

function fitQuadraticBezier(points: Point2D[]): { control: Point2D; error: number } {
  // Fit a quadratic Bézier to a polyline
  // Control point = intersection of tangent lines at start and end
  const start = points[0]
  const end = points[points.length - 1]

  // Tangent at start (from first two points)
  const t0x = points[1].x - points[0].x
  const t0z = points[1].z - points[0].z

  // Tangent at end (from last two points)
  const t1x = points[points.length - 1].x - points[points.length - 2].x
  const t1z = points[points.length - 1].z - points[points.length - 2].z

  // Find intersection of tangent lines
  const det = t0x * t1z - t0z * t1x
  if (Math.abs(det) < 0.001) {
    // Nearly parallel - use midpoint
    const mid = points[Math.floor(points.length / 2)]
    return { control: { x: mid.x, z: mid.z }, error: 0 }
  }

  const dx = end.x - start.x
  const dz = end.z - start.z
  const t = (dx * t1z - dz * t1x) / det

  const control: Point2D = {
    x: start.x + t * t0x,
    z: start.z + t * t0z,
  }

  // Compute fitting error
  let maxError = 0
  for (let i = 1; i < points.length - 1; i++) {
    const u = i / (points.length - 1)
    const u1 = 1 - u
    const bx = u1 * u1 * start.x + 2 * u1 * u * control.x + u * u * end.x
    const bz = u1 * u1 * start.z + 2 * u1 * u * control.z + u * u * end.z
    const err = Math.sqrt((points[i].x - bx) ** 2 + (points[i].z - bz) ** 2)
    maxError = Math.max(maxError, err)
  }

  return { control, error: maxError }
}

// ============================================================================
// Edge Calculation (matches roadGeometry.ts)
// ============================================================================

function computeEdges(
  startPoint: [number, number, number],
  endPoint: [number, number, number],
  controlPoint: [number, number, number] | undefined,
  trackMode: 'straight' | 'curve',
  halfWidth: number,
): {
  startLeftEdge: [number, number, number]
  startRightEdge: [number, number, number]
  endLeftEdge: [number, number, number]
  endRightEdge: [number, number, number]
} {
  if (trackMode === 'curve' && controlPoint) {
    // Curve: compute tangent at t=0 and t=1
    const tangent0x = 2 * (controlPoint[0] - startPoint[0])
    const tangent0z = 2 * (controlPoint[2] - startPoint[2])
    const len0 = Math.sqrt(tangent0x ** 2 + tangent0z ** 2) || 1
    const perp0x = -tangent0z / len0
    const perp0z = tangent0x / len0

    const tangent1x = 2 * (endPoint[0] - controlPoint[0])
    const tangent1z = 2 * (endPoint[2] - controlPoint[2])
    const len1 = Math.sqrt(tangent1x ** 2 + tangent1z ** 2) || 1
    const perp1x = -tangent1z / len1
    const perp1z = tangent1x / len1

    return {
      startLeftEdge: [startPoint[0] + perp0x * halfWidth, 0, startPoint[2] + perp0z * halfWidth],
      startRightEdge: [startPoint[0] - perp0x * halfWidth, 0, startPoint[2] - perp0z * halfWidth],
      endLeftEdge: [endPoint[0] + perp1x * halfWidth, 0, endPoint[2] + perp1z * halfWidth],
      endRightEdge: [endPoint[0] - perp1x * halfWidth, 0, endPoint[2] - perp1z * halfWidth],
    }
  }

  // Straight
  const dx = endPoint[0] - startPoint[0]
  const dz = endPoint[2] - startPoint[2]
  const len = Math.sqrt(dx * dx + dz * dz) || 1
  const perpX = -dz / len
  const perpZ = dx / len

  return {
    startLeftEdge: [startPoint[0] + perpX * halfWidth, 0, startPoint[2] + perpZ * halfWidth],
    startRightEdge: [startPoint[0] - perpX * halfWidth, 0, startPoint[2] - perpZ * halfWidth],
    endLeftEdge: [endPoint[0] + perpX * halfWidth, 0, endPoint[2] + perpZ * halfWidth],
    endRightEdge: [endPoint[0] - perpX * halfWidth, 0, endPoint[2] - perpZ * halfWidth],
  }
}

// ============================================================================
// OSM Data Processing
// ============================================================================

async function fetchOSMData(query: string): Promise<OSMResponse> {
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  console.log('Fetching OSM data...')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`)
  return res.json() as Promise<OSMResponse>
}

function extractNodesAndWays(data: OSMResponse): { nodes: Map<number, OSMNode>; ways: OSMWay[] } {
  const nodes = new Map<number, OSMNode>()
  const ways: OSMWay[] = []

  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, el)
    if (el.type === 'way') ways.push(el)
  }

  return { nodes, ways }
}

/**
 * Order ways into a continuous circuit using proximity-based chaining.
 * Instead of requiring exact endpoint matches, finds the nearest unvisited
 * way endpoint within a distance threshold.
 */
function orderWaysIntoCircuit(
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
    const dlon = (a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180) * 111320
    return Math.sqrt(dlat * dlat + dlon * dlon)
  }

  // Find start way
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

      if (dStart < bestDist) { bestDist = dStart; bestIdx = i; bestReverse = false }
      if (dEnd < bestDist) { bestDist = dEnd; bestIdx = i; bestReverse = true }
    }

    if (bestIdx === -1 || bestDist > maxGap) break

    used.add(bestIdx)
    const w = ways[bestIdx]
    const newNodes = bestReverse ? [...w.nodes].reverse() : [...w.nodes]
    // Skip first node if it's very close to our last node (shared endpoint)
    orderedNodes.push(...newNodes.slice(bestDist < 5 ? 1 : 0))
  }

  console.log(`  🔗 Chained ${used.size}/${ways.length} ways`)
  return orderedNodes
}

// ============================================================================
// Road Segment Generation
// ============================================================================

function generateRoadSegments(
  points: Point2D[],
  config: CircuitConfig,
): PlacedObject[] {
  const objects: PlacedObject[] = []
  let segId = 0

  // Split points into segments of manageable length
  const segments: Point2D[][] = []
  let currentSegment: Point2D[] = [points[0]]

  for (let i = 1; i < points.length; i++) {
    currentSegment.push(points[i])

    // Check accumulated length
    let segLen = 0
    for (let j = 1; j < currentSegment.length; j++) {
      const dx = currentSegment[j].x - currentSegment[j - 1].x
      const dz = currentSegment[j].z - currentSegment[j - 1].z
      segLen += Math.sqrt(dx * dx + dz * dz)
    }

    if (segLen >= MAX_SEGMENT_LENGTH || i === points.length - 1) {
      segments.push(currentSegment)
      currentSegment = [points[i]]
    }
  }

  // Get elevation at a fractional position along total track
  function getElevation(fraction: number): number {
    if (!config.elevationZones) return 0
    for (const zone of config.elevationZones) {
      if (fraction >= zone.startFraction && fraction <= zone.endFraction) {
        // Smooth bell curve within zone
        const zoneMid = (zone.startFraction + zone.endFraction) / 2
        const zoneHalf = (zone.endFraction - zone.startFraction) / 2
        const t = (fraction - zoneMid) / zoneHalf // -1 to 1
        const smooth = Math.cos(t * Math.PI) * 0.5 + 0.5 // 0 at edges, 1 at center
        return zone.elevation * smooth
      }
    }
    return 0
  }

  // Convert each segment to a PlacedObject
  let cumulativePoints = 0
  const totalPoints = points.length

  for (const seg of segments) {
    const startFraction = cumulativePoints / totalPoints
    const endFraction = (cumulativePoints + seg.length - 1) / totalPoints

    const startElev = getElevation(startFraction)
    const endElev = getElevation(endFraction)

    const start = seg[0]
    const end = seg[seg.length - 1]
    const startPt: [number, number, number] = [start.x, startElev, start.z]
    const endPt: [number, number, number] = [end.x, endElev, end.z]

    // Determine if this should be a curve or straight
    let isCurve = false
    let controlPt: [number, number, number] | undefined

    if (seg.length >= 3) {
      // Check curvature
      const midIdx = Math.floor(seg.length / 2)
      const curvature = computeCurvature(seg[0], seg[midIdx], seg[seg.length - 1])

      if (curvature > CURVATURE_THRESHOLD) {
        isCurve = true
        const fit = fitQuadraticBezier(seg)
        const ctrlElev = (startElev + endElev) / 2
        controlPt = [fit.control.x, ctrlElev, fit.control.z]
      }
    }

    const trackMode = isCurve ? 'curve' : 'straight'
    const midX = (start.x + end.x) / 2
    const midZ = (start.z + end.z) / 2
    const midElev = (startElev + endElev) / 2

    const edges = computeEdges(startPt, endPt, controlPt, trackMode, HALF_WIDTH)

    const roadObj: PlacedObject = {
      id: `road_${segId++}`,
      type: 'road',
      position: [midX, midElev, midZ],
      rotation: 0,
      startPoint: startPt,
      endPoint: endPt,
      trackMode,
      ...edges,
    }

    if (isCurve && controlPt) {
      roadObj.controlPoint = controlPt
    }

    if (startElev !== 0 || endElev !== 0) {
      roadObj.startElevation = startElev
      roadObj.endElevation = endElev
    }

    objects.push(roadObj)
    cumulativePoints += seg.length - 1
  }

  return objects
}

// ============================================================================
// Curb Generation
// ============================================================================

function generateCurbs(roads: PlacedObject[]): PlacedObject[] {
  const curbs: PlacedObject[] = []
  let curbId = 0

  for (const road of roads) {
    if (!road.startPoint || !road.endPoint) continue

    // Only place curbs on curve segments
    const isCurve = road.trackMode === 'curve' && road.controlPoint
    if (!isCurve) continue

    // Add curbs on both sides of curves
    for (const side of ['left', 'right'] as const) {
      curbs.push({
        id: `curb_${curbId++}`,
        type: 'curb',
        position: [0, 0, 0],
        rotation: 0,
        parentRoadId: road.id,
        edgeSide: side,
        startT: 0.05,
        endT: 0.95,
      } as any)
    }
  }

  return curbs
}

// ============================================================================
// Checkpoint Generation
// ============================================================================

function generateCheckpoints(
  roads: PlacedObject[],
  config: CircuitConfig,
): PlacedObject[] {
  const checkpoints: PlacedObject[] = []
  const totalRoads = roads.length

  // Start/finish line
  const sfIdx = Math.floor(config.startFinishFraction * totalRoads)
  const sfRoad = roads[sfIdx]
  if (sfRoad?.startPoint) {
    checkpoints.push({
      id: 'checkpoint_sf',
      type: 'checkpoint',
      position: [...sfRoad.startPoint] as [number, number, number],
      rotation: Math.atan2(
        (sfRoad.endPoint?.[0] ?? 0) - sfRoad.startPoint[0],
        (sfRoad.endPoint?.[2] ?? 0) - sfRoad.startPoint[2],
      ),
      checkpointType: 'start-finish',
      checkpointOrder: 0,
      width: TRACK_WIDTH,
    })
  }

  // Sector checkpoints
  for (let i = 0; i < config.sectorSplits.length; i++) {
    const fraction = config.sectorSplits[i]
    const idx = Math.floor(fraction * totalRoads)
    const road = roads[idx]
    if (road?.startPoint) {
      checkpoints.push({
        id: `checkpoint_s${i + 1}`,
        type: 'checkpoint',
        position: [...road.startPoint] as [number, number, number],
        rotation: Math.atan2(
          (road.endPoint?.[0] ?? 0) - road.startPoint[0],
          (road.endPoint?.[2] ?? 0) - road.startPoint[2],
        ),
        checkpointType: 'sector',
        checkpointOrder: i + 1,
        width: TRACK_WIDTH,
      })
    }
  }

  return checkpoints
}

// ============================================================================
// Barrier Generation (at track edges on straights)
// ============================================================================

function generateBarriers(roads: PlacedObject[]): PlacedObject[] {
  const barriers: PlacedObject[] = []
  let barrierId = 0

  // Add barriers every N road segments on both sides
  const interval = 5
  for (let i = 0; i < roads.length; i += interval) {
    const road = roads[i]
    if (!road.startPoint || !road.endPoint) continue
    if (!road.startLeftEdge || !road.startRightEdge) continue
    if (!road.endLeftEdge || !road.endRightEdge) continue

    // Left barrier
    const lStart: [number, number, number] = [
      road.startLeftEdge[0] + (road.startLeftEdge[0] - road.startPoint[0]) * 0.3,
      0,
      road.startLeftEdge[2] + (road.startLeftEdge[2] - road.startPoint[2]) * 0.3,
    ]
    const lEnd: [number, number, number] = [
      road.endLeftEdge[0] + (road.endLeftEdge[0] - (road.endPoint[0])) * 0.3,
      0,
      road.endLeftEdge[2] + (road.endLeftEdge[2] - (road.endPoint[2])) * 0.3,
    ]

    barriers.push({
      id: `barrier_l_${barrierId}`,
      type: 'barrier',
      position: [(lStart[0] + lEnd[0]) / 2, 0, (lStart[2] + lEnd[2]) / 2],
      rotation: 0,
      startPoint: lStart,
      endPoint: lEnd,
      trackMode: 'straight',
    })

    // Right barrier
    const rStart: [number, number, number] = [
      road.startRightEdge[0] + (road.startRightEdge[0] - road.startPoint[0]) * 0.3,
      0,
      road.startRightEdge[2] + (road.startRightEdge[2] - road.startPoint[2]) * 0.3,
    ]
    const rEnd: [number, number, number] = [
      road.endRightEdge[0] + (road.endRightEdge[0] - (road.endPoint[0])) * 0.3,
      0,
      road.endRightEdge[2] + (road.endRightEdge[2] - (road.endPoint[2])) * 0.3,
    ]

    barriers.push({
      id: `barrier_r_${barrierId}`,
      type: 'barrier',
      position: [(rStart[0] + rEnd[0]) / 2, 0, (rStart[2] + rEnd[2]) / 2],
      rotation: 0,
      startPoint: rStart,
      endPoint: rEnd,
      trackMode: 'straight',
    })

    barrierId++
  }

  return barriers
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function convertCircuit(circuitName: string): Promise<void> {
  const config = CIRCUITS[circuitName]
  if (!config) {
    console.error(`Unknown circuit: ${circuitName}`)
    console.log(`Available circuits: ${Object.keys(CIRCUITS).join(', ')}`)
    process.exit(1)
  }

  console.log(`\n🏎️  Converting ${config.displayName}...`)

  // 1. Fetch OSM data
  const osmData = await fetchOSMData(config.query)
  const { nodes, ways } = extractNodesAndWays(osmData)
  console.log(`  📍 Fetched ${nodes.size} nodes, ${ways.length} ways`)

  // 2. Filter to GP circuit ways
  let gpWays = ways
  if (config.filterWays) {
    gpWays = ways.filter(config.filterWays)
  }
  console.log(`  🏁 GP circuit: ${gpWays.length} ways`)

  // 3. Order ways into continuous circuit
  const orderedNodeIds = orderWaysIntoCircuit(gpWays, nodes, config.startWayName, config.maxChainGap ?? 100)
  console.log(`  🔗 Ordered circuit: ${orderedNodeIds.length} nodes`)

  // 4. Convert GPS to game world coordinates
  const worldPoints: Point2D[] = []
  for (const nodeId of orderedNodeIds) {
    const node = nodes.get(nodeId)
    if (!node) continue
    worldPoints.push(gpsToWorld(node.lat, node.lon, config.centerLat, config.centerLon))
  }
  console.log(`  🌍 Converted ${worldPoints.length} GPS points to world coordinates`)

  // 5. Simplify polyline
  const simplified = douglasPeucker(worldPoints, SIMPLIFY_TOLERANCE)
  console.log(`  ✂️  Simplified: ${worldPoints.length} → ${simplified.length} points`)

  // 6. Generate road segments
  const roads = generateRoadSegments(simplified, config)
  console.log(`  🛣️  Generated ${roads.length} road segments`)

  // 7. Generate curbs
  const curbs = generateCurbs(roads)
  console.log(`  🟥 Generated ${curbs.length} curbs`)

  // 8. Generate checkpoints
  const checkpoints = generateCheckpoints(roads, config)
  console.log(`  🏁 Generated ${checkpoints.length} checkpoints`)

  // 9. Generate barriers
  const barriers = generateBarriers(roads)
  console.log(`  🧱 Generated ${barriers.length} barriers`)

  // 10. Combine all objects
  const allObjects: PlacedObject[] = [...roads, ...curbs, ...checkpoints, ...barriers]
  console.log(`  📦 Total objects: ${allObjects.length}`)

  // 11. Compute track stats
  let totalLength = 0
  for (const road of roads) {
    if (road.startPoint && road.endPoint) {
      const dx = road.endPoint[0] - road.startPoint[0]
      const dz = road.endPoint[2] - road.startPoint[2]
      totalLength += Math.sqrt(dx * dx + dz * dz)
    }
  }

  // 12. Write output
  const output = {
    name: config.displayName,
    id: `f1_${config.name}`,
    trackLength: Math.round(totalLength),
    turns: config.sectorSplits.length + 1, // placeholder
    objects: allObjects,
  }

  const outPath = `src/constants/tracks/${config.name}.json`
  await Bun.write(outPath, JSON.stringify(output, null, 2))
  console.log(`\n  ✅ Written to ${outPath}`)
  console.log(`  📏 Track length: ~${Math.round(totalLength)}m`)

  // Bounding box
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of worldPoints) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  console.log(`  📐 Bounding box: ${Math.round(maxX - minX)}m × ${Math.round(maxZ - minZ)}m`)
  console.log(`  📐 Center offset: x=${Math.round((minX + maxX) / 2)}, z=${Math.round((minZ + maxZ) / 2)}`)
}

// ============================================================================
// CLI Entry
// ============================================================================

const args = process.argv.slice(2)
if (args.length === 0) {
  console.log('Usage: bun run scripts/convert-osm-track.ts <circuit-name>')
  console.log(`Available circuits: ${Object.keys(CIRCUITS).join(', ')}`)
  process.exit(0)
}

const circuitName = args[0].toLowerCase()
convertCircuit(circuitName).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
