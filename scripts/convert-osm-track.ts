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
  /** Reverse the chained node order (fix wrong-way circuits) */
  reverseDirection?: boolean
  /** Number of turns on this circuit */
  turns?: number
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
      const excludePatterns = [
        'Stowe Circuit',
        'Stowe CircuitPit',
        'Stowe Circuit Pit',
        'International pit lane',
        'Ice Hill',
      ]
      if (excludePatterns.some(e => name.includes(e))) return false
      return true
    },
    /** Way name to start chaining from */
    startWayName: 'National Pit Straight',
    sectorSplits: [0.33, 0.66],
    startFinishFraction: 0.0,
    reverseDirection: true,
    turns: 18,
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
        'Pit Lane',
        'West Circuit Pit Lane',
        '鈴鹿サーキット国際南コース',
        'プッチグランプリ',
        'DREAM R',
        'アクロエックス',
        'ene-1',
        'ロッキーコースター',
        'チララのフラワーワゴン',
        'アドベンチャードライブ',
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
    reverseDirection: true,
    turns: 18,
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
  const x = (lon - centerLon) * Math.cos((centerLat * Math.PI) / 180) * 111320
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
  const t = Math.max(
    0,
    Math.min(1, ((point.x - lineStart.x) * dx + (point.z - lineStart.z) * dz) / lineLenSq),
  )
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
    const dlon = (a[1] - b[1]) * Math.cos((a[0] * Math.PI) / 180) * 111320
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
    // Skip first node if it's very close to our last node (shared endpoint)
    orderedNodes.push(...newNodes.slice(bestDist < 5 ? 1 : 0))
  }

  console.log(`  🔗 Chained ${used.size}/${ways.length} ways`)
  return orderedNodes
}

// ============================================================================
// Road Segment Generation
// ============================================================================

function dist2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dz = b.z - a.z
  return Math.sqrt(dx * dx + dz * dz)
}

interface JunctionEdge {
  left: [number, number, number]
  right: [number, number, number]
  heading: number
}

function computeJunctionEdges(
  points: Point2D[],
  halfWidth: number,
  getElevation: (fraction: number) => number,
  isClosed: boolean,
): JunctionEdge[] {
  const n = points.length
  const edges: JunctionEdge[] = []

  for (let i = 0; i < n; i++) {
    const fraction = i / (n - 1)
    const elev = getElevation(fraction)

    let inX: number, inZ: number, outX: number, outZ: number

    if (i === 0) {
      if (isClosed) {
        inX = points[0].x - points[n - 2].x
        inZ = points[0].z - points[n - 2].z
      } else {
        inX = points[1].x - points[0].x
        inZ = points[1].z - points[0].z
      }
      outX = points[1].x - points[0].x
      outZ = points[1].z - points[0].z
    } else if (i === n - 1) {
      inX = points[n - 1].x - points[n - 2].x
      inZ = points[n - 1].z - points[n - 2].z
      if (isClosed) {
        outX = points[1].x - points[0].x
        outZ = points[1].z - points[0].z
      } else {
        outX = inX
        outZ = inZ
      }
    } else {
      inX = points[i].x - points[i - 1].x
      inZ = points[i].z - points[i - 1].z
      outX = points[i + 1].x - points[i].x
      outZ = points[i + 1].z - points[i].z
    }

    const inLen = Math.sqrt(inX * inX + inZ * inZ) || 1
    const outLen = Math.sqrt(outX * outX + outZ * outZ) || 1
    const nInX = inX / inLen
    const nInZ = inZ / inLen
    const nOutX = outX / outLen
    const nOutZ = outZ / outLen

    let tx = nInX + nOutX
    let tz = nInZ + nOutZ
    const tLen = Math.sqrt(tx * tx + tz * tz)
    if (tLen < 0.001) {
      tx = nOutX
      tz = nOutZ
    } else {
      tx /= tLen
      tz /= tLen
    }

    const perpX = -tz
    const perpZ = tx
    const heading = Math.atan2(tx, tz)

    const p = points[i]
    edges.push({
      left: [p.x + perpX * halfWidth, elev, p.z + perpZ * halfWidth],
      right: [p.x - perpX * halfWidth, elev, p.z - perpZ * halfWidth],
      heading,
    })
  }

  return edges
}

function generateRoadSegments(points: Point2D[], config: CircuitConfig): PlacedObject[] {
  const objects: PlacedObject[] = []
  let segId = 0

  const segments: { startIdx: number; endIdx: number; subPoints: Point2D[] }[] = []
  let currentStart = 0
  let currentSubPoints: Point2D[] = [points[0]]

  for (let i = 1; i < points.length; i++) {
    let currentLen = 0
    for (let j = 1; j < currentSubPoints.length; j++) {
      currentLen += dist2D(currentSubPoints[j - 1], currentSubPoints[j])
    }
    const candidateLen = dist2D(currentSubPoints[currentSubPoints.length - 1], points[i])
    const wouldBeLen = currentLen + candidateLen

    if (currentSubPoints.length > 1 && wouldBeLen >= MAX_SEGMENT_LENGTH) {
      segments.push({ startIdx: currentStart, endIdx: i - 1, subPoints: [...currentSubPoints] })
      currentStart = i - 1
      currentSubPoints = [points[i - 1], points[i]]
    } else {
      currentSubPoints.push(points[i])
    }

    if (i === points.length - 1 && currentSubPoints.length > 1) {
      segments.push({ startIdx: currentStart, endIdx: i, subPoints: currentSubPoints })
    }
  }

  function getElevation(fraction: number): number {
    if (!config.elevationZones) return 0
    for (const zone of config.elevationZones) {
      if (fraction >= zone.startFraction && fraction <= zone.endFraction) {
        const zoneMid = (zone.startFraction + zone.endFraction) / 2
        const zoneHalf = (zone.endFraction - zone.startFraction) / 2
        const t = (fraction - zoneMid) / zoneHalf
        const smooth = Math.cos(t * Math.PI) * 0.5 + 0.5
        return zone.elevation * smooth
      }
    }
    return 0
  }

  const first = points[0]
  const last = points[points.length - 1]
  const closureGap = dist2D(first, last)
  const isClosed = closureGap < 5.0

  const junctions = computeJunctionEdges(points, HALF_WIDTH, getElevation, isClosed)
  const totalPoints = points.length

  for (const seg of segments) {
    const startFraction = seg.startIdx / (totalPoints - 1)
    const endFraction = seg.endIdx / (totalPoints - 1)
    const startElev = getElevation(startFraction)
    const endElev = getElevation(endFraction)

    const start = points[seg.startIdx]
    const end = points[seg.endIdx]
    const startPt: [number, number, number] = [start.x, startElev, start.z]
    const endPt: [number, number, number] = [end.x, endElev, end.z]

    const startEdge = junctions[seg.startIdx]
    const endEdge = junctions[seg.endIdx]

    let isCurve = false
    let controlPt: [number, number, number] | undefined

    if (seg.subPoints.length >= 3) {
      const midIdx = Math.floor(seg.subPoints.length / 2)
      const curvature = computeCurvature(seg.subPoints[0], seg.subPoints[midIdx], seg.subPoints[seg.subPoints.length - 1])

      if (curvature > CURVATURE_THRESHOLD) {
        isCurve = true
        const fit = fitQuadraticBezier(seg.subPoints)
        const ctrlElev = (startElev + endElev) / 2
        controlPt = [fit.control.x, ctrlElev, fit.control.z]
      }
    }

    const trackMode = isCurve ? 'curve' : 'straight'
    const midX = (start.x + end.x) / 2
    const midZ = (start.z + end.z) / 2
    const midElev = (startElev + endElev) / 2

    const roadObj: PlacedObject = {
      id: `road_${segId++}`,
      type: 'road',
      position: [midX, midElev, midZ],
      rotation: 0,
      startPoint: startPt,
      endPoint: endPt,
      trackMode,
      startLeftEdge: startEdge.left,
      startRightEdge: startEdge.right,
      endLeftEdge: endEdge.left,
      endRightEdge: endEdge.right,
    }

    if (isCurve && controlPt) {
      roadObj.controlPoint = controlPt
    }

    if (startElev !== 0 || endElev !== 0) {
      roadObj.startElevation = startElev
      roadObj.endElevation = endElev
    }

    objects.push(roadObj)
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

function generateCheckpoints(roads: PlacedObject[], config: CircuitConfig): PlacedObject[] {
  const checkpoints: PlacedObject[] = []
  const totalRoads = roads.length

  function makeCheckpoint(
    id: string,
    road: PlacedObject,
    type: 'start-finish' | 'sector',
    order: number,
  ): PlacedObject {
    const sp = road.startPoint!
    const ep = road.endPoint!
    const rotation = Math.atan2(ep[0] - sp[0], ep[2] - sp[2])
    const perpAngle = rotation + Math.PI / 2
    const hw = TRACK_WIDTH / 2
    const cpStartPoint: [number, number, number] = [
      sp[0] + Math.sin(perpAngle) * hw,
      sp[1],
      sp[2] + Math.cos(perpAngle) * hw,
    ]
    const cpEndPoint: [number, number, number] = [
      sp[0] - Math.sin(perpAngle) * hw,
      sp[1],
      sp[2] - Math.cos(perpAngle) * hw,
    ]
    return {
      id,
      type: 'checkpoint',
      position: [...sp] as [number, number, number],
      rotation,
      startPoint: cpStartPoint,
      endPoint: cpEndPoint,
      checkpointType: type,
      checkpointOrder: order,
      width: TRACK_WIDTH,
    }
  }

  const sfIdx = Math.floor(config.startFinishFraction * totalRoads)
  const sfRoad = roads[sfIdx]
  if (sfRoad?.startPoint && sfRoad?.endPoint) {
    checkpoints.push(makeCheckpoint('checkpoint_sf', sfRoad, 'start-finish', 0))
  }

  for (let i = 0; i < config.sectorSplits.length; i++) {
    const fraction = config.sectorSplits[i]
    const idx = Math.floor(fraction * totalRoads)
    const road = roads[idx]
    if (road?.startPoint && road?.endPoint) {
      checkpoints.push(makeCheckpoint(`checkpoint_s${i + 1}`, road, 'sector', i + 1))
    }
  }

  return checkpoints
}

// ============================================================================
// Barrier Generation (at track edges on straights)
// ============================================================================

function generateBarriers(roads: PlacedObject[], checkpointRoadIndices: Set<number>): PlacedObject[] {
  const barriers: PlacedObject[] = []
  let barrierId = 0

  const interval = 5
  for (let i = 0; i < roads.length; i += interval) {
    if (checkpointRoadIndices.has(i)) continue
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
      road.endLeftEdge[0] + (road.endLeftEdge[0] - road.endPoint[0]) * 0.3,
      0,
      road.endLeftEdge[2] + (road.endLeftEdge[2] - road.endPoint[2]) * 0.3,
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
      road.endRightEdge[0] + (road.endRightEdge[0] - road.endPoint[0]) * 0.3,
      0,
      road.endRightEdge[2] + (road.endRightEdge[2] - road.endPoint[2]) * 0.3,
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
  const orderedNodeIds = orderWaysIntoCircuit(
    gpWays,
    nodes,
    config.startWayName,
    config.maxChainGap ?? 100,
  )
  console.log(`  🔗 Ordered circuit: ${orderedNodeIds.length} nodes`)

  if (config.reverseDirection) {
    orderedNodeIds.reverse()
    console.log('  🔄 Reversed circuit direction')
  }

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

  // 9. Generate barriers (skip near checkpoint road indices)
  const totalRoads = roads.length
  const cpRoadIndices = new Set<number>()
  const cpCoreIndices = [
    Math.floor(config.startFinishFraction * totalRoads),
    ...config.sectorSplits.map(s => Math.floor(s * totalRoads)),
  ]
  for (const idx of cpCoreIndices) {
    for (let offset = -1; offset <= 1; offset++) {
      const j = idx + offset
      if (j >= 0 && j < totalRoads) cpRoadIndices.add(j)
    }
  }
  const barriers = generateBarriers(roads, cpRoadIndices)
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
    turns: config.turns ?? config.sectorSplits.length + 1,
    objects: allObjects,
  }

  const outPath = `src/constants/tracks/${config.name}.json`
  await Bun.write(outPath, JSON.stringify(output, null, 2))
  console.log(`\n  ✅ Written to ${outPath}`)
  console.log(`  📏 Track length: ~${Math.round(totalLength)}m`)

  // Bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity
  for (const p of worldPoints) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  console.log(`  📐 Bounding box: ${Math.round(maxX - minX)}m × ${Math.round(maxZ - minZ)}m`)
  console.log(
    `  📐 Center offset: x=${Math.round((minX + maxX) / 2)}, z=${Math.round((minZ + maxZ) / 2)}`,
  )
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
