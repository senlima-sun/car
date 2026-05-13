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
import { validateTrackSource } from './lib/validate/validate-source'

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

function collapseNearbyPoints(points: Point2D[], minSpacing: number): Point2D[] {
  if (points.length <= 2) return points
  const out: Point2D[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    if (dist2D(out[out.length - 1], points[i]) >= minSpacing) {
      out.push(points[i])
    }
  }
  const last = points[points.length - 1]
  if (dist2D(out[out.length - 1], last) >= minSpacing) {
    out.push(last)
  } else if (out.length >= 2) {
    out[out.length - 1] = last
  } else {
    out.push(last)
  }
  return out
}

function closeRingIfNear(points: Point2D[], maxGap: number): Point2D[] {
  if (points.length < 3) return points
  const first = points[0]!
  const last = points[points.length - 1]!
  const gap = dist2D(first, last)
  if (gap < 1) {
    if (gap === 0) return points
    const out = points.slice(0, -1)
    out.push({ x: first.x, z: first.z })
    return out
  }
  if (gap > maxGap) return points
  const out = points.slice()
  out.push({ x: first.x, z: first.z })
  return out
}

function resampleToUniformSpacing(points: Point2D[], targetSpacing: number): Point2D[] {
  if (points.length < 2) return points
  const out: Point2D[] = [points[0]!]
  let carry = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const segLen = Math.hypot(dx, dz)
    if (segLen < 1e-6) continue
    let dist = targetSpacing - carry
    while (dist < segLen) {
      const t = dist / segLen
      out.push({ x: a.x + dx * t, z: a.z + dz * t })
      dist += targetSpacing
    }
    carry = segLen - (dist - targetSpacing)
  }
  const last = points[points.length - 1]!
  if (dist2D(out[out.length - 1]!, last) > targetSpacing * 0.25) {
    out.push(last)
  } else if (out.length >= 2) {
    out[out.length - 1] = last
  }
  return out
}

function smoothSharpAngles(points: Point2D[], maxPasses: number): Point2D[] {
  if (points.length < 3) return points
  let current = points.slice()
  for (let pass = 0; pass < maxPasses; pass++) {
    let modified = false
    const next: Point2D[] = [current[0]]
    for (let i = 1; i < current.length - 1; i++) {
      const prev = current[i - 1]
      const here = current[i]
      const after = current[i + 1]
      const ax = here.x - prev.x
      const az = here.z - prev.z
      const bx = after.x - here.x
      const bz = after.z - here.z
      const aLen = Math.hypot(ax, az)
      const bLen = Math.hypot(bx, bz)
      if (aLen < 0.001 || bLen < 0.001) {
        modified = true
        continue
      }
      const cosTheta = (ax * bx + az * bz) / (aLen * bLen)
      if (cosTheta < -0.5) {
        modified = true
        continue
      }
      next.push(here)
    }
    next.push(current[current.length - 1])
    if (!modified) return next
    current = next
  }
  return current
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
  const config = (await file.json()) as CircuitConfigFile
  if (config.name !== circuitName) {
    console.error(
      `Invalid config ${configPath}: name "${config.name}" does not match CLI argument "${circuitName}"`,
    )
    process.exit(1)
  }
  if (typeof config.expectedTrackLengthMeters !== 'number' || config.expectedTrackLengthMeters <= 0) {
    console.error(
      `Invalid config ${configPath}: expectedTrackLengthMeters must be a positive number`,
    )
    process.exit(1)
  }
  if (config.provenance === 'osm') {
    if (!config.overpass || config.overpass.bbox.length !== 4) {
      console.error(
        `Invalid config ${configPath}: provenance "osm" requires overpass with a 4-element bbox`,
      )
      process.exit(1)
    }
    if (config.centerLat == null || config.centerLon == null) {
      console.error(
        `Invalid config ${configPath}: provenance "osm" requires centerLat and centerLon`,
      )
      process.exit(1)
    }
  }
  return config
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

  const query = buildOverpassQuery(
    config.overpass.bbox,
    config.overpass.queryFilters,
    config.overpass.relationId,
  )
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

  const { centerLat, centerLon } = config
  if (centerLat == null || centerLon == null) {
    throw new Error(`${config.name}: centerLat/centerLon must be set for OSM provenance`)
  }

  const worldPoints: Point2D[] = []
  for (const nodeId of orderedNodeIds) {
    const node = nodes.get(nodeId)
    if (!node) continue
    worldPoints.push(
      gpsToWorld(node.lat, node.lon, centerLat, centerLon),
    )
  }
  console.log(`  🌍 Converted ${worldPoints.length} GPS points to world coordinates`)

  const simplified = douglasPeucker(worldPoints, SIMPLIFY_TOLERANCE)
  const dedupedRaw = collapseNearbyPoints(simplified, 3)
  const smoothed = smoothSharpAngles(dedupedRaw, 5)
  const resampled = resampleToUniformSpacing(smoothed, 25)
  const deduped = closeRingIfNear(resampled, 1500)
  console.log(
    `  ✂️  Simplified: ${worldPoints.length} → ${simplified.length} → ${dedupedRaw.length} (collapsed) → ${smoothed.length} (smoothed) → ${resampled.length} (resampled@25m) → ${deduped.length} (closed) points`,
  )

  let totalLength = 0
  for (let i = 1; i < deduped.length; i++) {
    const dx = deduped[i]!.x - deduped[i - 1]!.x
    const dz = deduped[i]!.z - deduped[i - 1]!.z
    totalLength += Math.sqrt(dx * dx + dz * dz)
  }

  let sectorSplits: [number, number]
  if (config.sectorSplits) {
    sectorSplits = config.sectorSplits
    console.log(`  📐 Using manual sectorSplits override: [${sectorSplits.join(', ')}]`)
  } else {
    sectorSplits = autoDetectSectorSplits(deduped)
    console.log(`  📐 Auto-detected sectorSplits: [${sectorSplits.join(', ')}]`)
  }

  const source = buildEditorTrackSourceFromPolyline({
    id: `f1_${config.name}`,
    name: config.displayName,
    trackLength: Math.round(totalLength),
    turns: config.expectedTurns,
    points: deduped.map(point => ({ x: point.x, z: point.z })),
    sectorSplits,
    startFinishFraction: config.startFinishFraction,
  })

  for (const path of source.paths) {
    if (!path.closed) continue
    const anchors = path.anchors
    if (anchors.length < 2) continue
    const first = anchors[0]!
    first.handleType = 'corner'
    first.inHandle = { x: first.point.x, y: first.point.y }
    first.outHandle = { x: first.point.x, y: first.point.y }
    const last = anchors[anchors.length - 1]!
    last.handleType = 'corner'
    last.inHandle = { x: last.point.x, y: last.point.y }
    last.outHandle = { x: last.point.x, y: last.point.y }
  }

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

  const report = validateTrackSource(source, config)
  if (!report.canRace) {
    const criticals = report.results.filter(r => r.severity === 'critical')
    for (const issue of criticals) {
      process.stderr.write(`  [CRITICAL] ${issue.rule}: ${issue.message}\n`)
    }
    console.error(
      '\n  Validation FAILED — source has been written for inspection but should NOT be committed',
    )
    process.exit(1)
  }
  console.log('  Validation OK')
}

// ============================================================================
// CLI Entry
// ============================================================================

const args = process.argv.slice(2)
if (args.length === 0) {
  const available = await discoverCircuitNames()
  console.log('Usage: bun run track:ingest <circuit-name>')
  console.log(`Available circuits: ${available.join(', ')}`)
  process.exit(0)
}

const circuitName = args[0].toLowerCase()
const available = await discoverCircuitNames()
if (!available.includes(circuitName)) {
  console.error(`Unknown circuit: ${circuitName}`)
  console.error(`Available: ${available.join(', ')}`)
  process.exit(1)
}

convertCircuit(circuitName).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
