#!/usr/bin/env bun

import { buildEditorTrackSourceFromPolyline } from '../src/utils/editorTrackSourceFromPolyline'
import { gpsToWorld, douglasPeucker, autoDetectSectorSplits } from './lib/osm-ingest'
import type { Point2D } from './lib/osm-ingest'
import type { CircuitConfigFile } from './circuits/_schema'
import { validateTrackSource } from './lib/validate/validate-source'

interface GeoJsonFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
}

interface GeoJsonFile {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

const SIMPLIFY_TOLERANCE = 1.0

function dist2D(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.z - a.z)
}

function collapseNearbyPoints(points: Point2D[], minSpacing: number): Point2D[] {
  if (points.length <= 2) return points
  const out: Point2D[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    if (dist2D(out[out.length - 1]!, points[i]!) >= minSpacing) out.push(points[i]!)
  }
  const last = points[points.length - 1]!
  if (dist2D(out[out.length - 1]!, last) >= minSpacing) out.push(last)
  else if (out.length >= 2) out[out.length - 1] = last
  else out.push(last)
  return out
}

function smoothSharpAngles(points: Point2D[], maxPasses: number): Point2D[] {
  if (points.length < 3) return points
  let current = points.slice()
  for (let pass = 0; pass < maxPasses; pass++) {
    let modified = false
    const next: Point2D[] = [current[0]!]
    for (let i = 1; i < current.length - 1; i++) {
      const prev = current[i - 1]!
      const here = current[i]!
      const after = current[i + 1]!
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
    next.push(current[current.length - 1]!)
    if (!modified) return next
    current = next
  }
  return current
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

function curvatureAt(points: Point2D[], i: number): number {
  const n = points.length
  if (n < 3) return 0
  const prev = points[(i - 1 + n) % n]!
  const here = points[i]!
  const next = points[(i + 1) % n]!
  const ax = here.x - prev.x
  const az = here.z - prev.z
  const bx = next.x - here.x
  const bz = next.z - here.z
  const aLen = Math.hypot(ax, az)
  const bLen = Math.hypot(bx, bz)
  if (aLen < 0.001 || bLen < 0.001) return 0
  const cross = ax * bz - az * bx
  const triArea = Math.abs(cross) / 2
  const chordLen = Math.hypot(next.x - prev.x, next.z - prev.z) || 0.001
  return (4 * triArea) / (aLen * bLen * chordLen)
}

function adaptiveResample(points: Point2D[], baseSpacing: number, minSpacing: number): Point2D[] {
  if (points.length < 3) return points
  const uniform = resampleToUniformSpacing(points, baseSpacing)
  const out: Point2D[] = [uniform[0]!]
  for (let i = 1; i < uniform.length; i++) {
    const a = out[out.length - 1]!
    const b = uniform[i]!
    const segLen = dist2D(a, b)
    const curv = Math.max(curvatureAt(uniform, i - 1), curvatureAt(uniform, i))
    const targetSpacing = Math.max(minSpacing, baseSpacing / (1 + curv * 60))
    if (segLen <= targetSpacing * 1.5) {
      out.push(b)
      continue
    }
    const steps = Math.max(2, Math.ceil(segLen / targetSpacing))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  }
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
  if (dist2D(out[out.length - 1]!, last) > targetSpacing * 0.25) out.push(last)
  else if (out.length >= 2) out[out.length - 1] = last
  return out
}

async function main(): Promise<void> {
  const name = process.argv[2]
  const geojsonPath = process.argv[3]
  if (!name || !geojsonPath) {
    console.error('Usage: bun run scripts/import-geojson-track.ts <name> <geojson-file-or-url>')
    process.exit(1)
  }

  const configPath = `scripts/circuits/${name}.config.json`
  const config = (await Bun.file(configPath).json()) as CircuitConfigFile

  let geojsonText: string
  if (geojsonPath.startsWith('http')) {
    const res = await fetch(geojsonPath)
    if (!res.ok) throw new Error(`Failed to fetch ${geojsonPath}: ${res.status}`)
    geojsonText = await res.text()
  } else {
    geojsonText = await Bun.file(geojsonPath).text()
  }
  const geo = JSON.parse(geojsonText) as GeoJsonFile | GeoJsonFeature

  let coords: [number, number][] | undefined
  if ('features' in geo) {
    const f = geo.features.find(feat => {
      const props = feat.properties as { id?: string; Name?: string }
      return props.id === name || props.Name === config.displayName
    })
    if (!f) throw new Error(`No feature with id=${name} or Name=${config.displayName} in GeoJSON`)
    coords = f.geometry.coordinates
  } else if (geo.type === 'Feature') {
    coords = geo.geometry.coordinates
  }
  if (!coords || coords.length < 3) throw new Error('Need at least 3 coordinates')

  const { centerLat, centerLon } = config
  if (centerLat == null || centerLon == null) {
    throw new Error('config must have centerLat / centerLon')
  }

  const worldPoints: Point2D[] = coords.map(([lon, lat]) => gpsToWorld(lat, lon, centerLat, centerLon))
  console.log(`  📍 Loaded ${worldPoints.length} GeoJSON points`)

  const simplified = douglasPeucker(worldPoints, SIMPLIFY_TOLERANCE)
  const dedupedRaw = collapseNearbyPoints(simplified, 3)
  const smoothed = smoothSharpAngles(dedupedRaw, 5)
  const resampled = adaptiveResample(smoothed, 25, 8)
  const deduped = closeRingIfNear(resampled, 1500)
  console.log(
    `  ✂️  ${worldPoints.length} → ${simplified.length} → ${dedupedRaw.length} → ${smoothed.length} → ${resampled.length} → ${deduped.length} points`,
  )

  let totalLength = 0
  for (let i = 1; i < deduped.length; i++) {
    totalLength += dist2D(deduped[i - 1]!, deduped[i]!)
  }

  let sectorSplits: [number, number]
  if (config.sectorSplits) {
    sectorSplits = config.sectorSplits
  } else {
    try {
      sectorSplits = autoDetectSectorSplits(deduped)
    } catch {
      sectorSplits = [0.33, 0.66]
    }
  }

  const source = buildEditorTrackSourceFromPolyline({
    id: `f1_${config.name}`,
    name: config.displayName,
    trackLength: Math.round(totalLength),
    turns: config.expectedTurns,
    points: deduped.map(p => ({ x: p.x, z: p.z })),
    sectorSplits,
    startFinishFraction: config.startFinishFraction,
  })

  for (const path of source.paths) {
    if (!path.closed) continue
    const anchors = path.anchors
    if (anchors.length < 3) continue
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i]!
      const prev = anchors[(i - 1 + anchors.length) % anchors.length]!
      const next = anchors[(i + 1) % anchors.length]!
      const tangentX = (next.point.x - prev.point.x) / 6
      const tangentY = (next.point.y - prev.point.y) / 6
      a.handleType = 'smooth'
      a.inHandle = { x: a.point.x - tangentX, y: a.point.y - tangentY }
      a.outHandle = { x: a.point.x + tangentX, y: a.point.y + tangentY }
    }
  }

  const outPath = `src/constants/tracks/sources/${config.name}.json`
  await Bun.write(outPath, JSON.stringify(source, null, 2))
  console.log(`  ✅ Written to ${outPath}`)
  console.log(`  📏 Track length: ${Math.round(totalLength)}m`)

  const report = validateTrackSource(source, config)
  if (!report.canRace) {
    for (const r of report.results) {
      if (r.severity === 'critical') console.error(`  [CRITICAL] ${r.rule}: ${r.message}`)
    }
    process.exit(1)
  }
  console.log('  Validation OK')
}

await main()
