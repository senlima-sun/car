#!/usr/bin/env bun

import { buildEditorTrackSourceFromPolyline } from '../src/utils/editorTrackSourceFromPolyline'
import {
  fetchOSMData,
  extractNodesAndWays,
  orderWaysIntoCircuit,
  gpsToWorld,
  douglasPeucker,
  computeCurvature,
  fitQuadraticBezier,
} from './lib/osm-ingest'
import type { Point2D } from './lib/osm-ingest'
import type { CircuitConfigFile } from './circuits/_schema'
import { buildOverpassQuery } from './lib/osm-ingest/overpass'
import { autoDetectSectorSplits } from './lib/osm-ingest/sectors'

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Constants
// ============================================================================

const TRACK_WIDTH = 12
const HALF_WIDTH = TRACK_WIDTH / 2
const SIMPLIFY_TOLERANCE = 1.0
const MAX_SEGMENT_LENGTH = 60
const CURVATURE_THRESHOLD = 0.005

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

function generateRoadSegments(
  points: Point2D[],
  config: Pick<CircuitConfigFile, 'elevationZones'>,
): PlacedObject[] {
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
      const curvature = computeCurvature(
        seg.subPoints[0],
        seg.subPoints[midIdx],
        seg.subPoints[seg.subPoints.length - 1],
      )

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
// Main Pipeline
// ============================================================================

async function loadConfig(circuitName: string): Promise<CircuitConfigFile> {
  const configPath = `scripts/circuits/${circuitName}.config.json`
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    const available = await discoverCircuitNames()
    console.error(`Unknown circuit: ${circuitName}`)
    console.log(`Available circuits: ${available.join(', ')}`)
    process.exit(1)
  }
  return file.json() as Promise<CircuitConfigFile>
}

async function discoverCircuitNames(): Promise<string[]> {
  const glob = new Bun.Glob('scripts/circuits/*.config.json')
  const names: string[] = []
  for await (const file of glob.scan('.')) {
    const match = file.match(/scripts\/circuits\/(.+)\.config\.json$/)
    if (match) names.push(match[1])
  }
  return names.sort()
}

async function convertCircuit(circuitName: string): Promise<void> {
  const config = await loadConfig(circuitName)

  if (config.provenance === 'manual') {
    console.log(
      `Skipped: ${config.displayName} — manual provenance, source is the canonical artefact`,
    )
    process.exit(0)
  }

  if (!config.overpass) {
    console.error(`Circuit ${circuitName} is provenance:osm but missing overpass config`)
    process.exit(1)
  }

  console.log(`\n🏎️  Converting ${config.displayName}...`)

  const query = buildOverpassQuery(config.overpass.bbox, config.overpass.queryFilters)
  const osmData = await fetchOSMData(query)
  const { nodes, ways } = extractNodesAndWays(osmData)
  console.log(`  📍 Fetched ${nodes.size} nodes, ${ways.length} ways`)

  const denyList = config.wayNameDenyList ?? []
  const gpWays = ways.filter(way => {
    const name = way.tags?.name ?? ''
    return !denyList.some(pattern => name.includes(pattern))
  })
  console.log(`  🏁 GP circuit: ${gpWays.length} ways`)

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

  const worldPoints: Point2D[] = []
  for (const nodeId of orderedNodeIds) {
    const node = nodes.get(nodeId)
    if (!node) continue
    worldPoints.push(
      gpsToWorld(node.lat, node.lon, config.centerLat ?? 0, config.centerLon ?? 0),
    )
  }
  console.log(`  🌍 Converted ${worldPoints.length} GPS points to world coordinates`)

  const simplified = douglasPeucker(worldPoints, SIMPLIFY_TOLERANCE)
  console.log(`  ✂️  Simplified: ${worldPoints.length} → ${simplified.length} points`)

  let totalLength = 0
  for (let i = 1; i < simplified.length; i++) {
    const dx = simplified[i]!.x - simplified[i - 1]!.x
    const dz = simplified[i]!.z - simplified[i - 1]!.z
    totalLength += Math.sqrt(dx * dx + dz * dz)
  }

  let sectorSplits: [number, number]
  if (config.sectorSplits) {
    sectorSplits = config.sectorSplits
    console.log(`  📐 Using manual sectorSplits override: [${sectorSplits.join(', ')}]`)
  } else {
    sectorSplits = autoDetectSectorSplits(simplified)
    console.log(`  📐 Auto-detected sectorSplits: [${sectorSplits.join(', ')}]`)
  }

  const source = buildEditorTrackSourceFromPolyline({
    id: `f1_${config.name}`,
    name: config.displayName,
    trackLength: Math.round(totalLength),
    turns: config.expectedTurns,
    points: simplified.map(point => ({ x: point.x, z: point.z })),
    sectorSplits,
    startFinishFraction: config.startFinishFraction,
  })

  const outPath = `src/constants/tracks/sources/${config.name}.json`
  await Bun.write(outPath, JSON.stringify(source, null, 2))
  console.log(`\n  ✅ Written to ${outPath}`)
  console.log(`  📏 Track length: ~${Math.round(totalLength)}m`)
  console.log(
    `  🧭 Source path anchors: ${source.paths[0]?.anchors.length ?? 0}, checkpoints: ${source.checkpoints.length}`,
  )

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
  const available = await discoverCircuitNames()
  console.log('Usage: bun run scripts/convert-osm-track.ts <circuit-name>')
  console.log(`Available circuits: ${available.join(', ')}`)
  process.exit(0)
}

const circuitName = args[0].toLowerCase()
convertCircuit(circuitName).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
