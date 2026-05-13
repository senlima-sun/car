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
  const resampled = resampleToUniformSpacing(smoothed, 25)
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
