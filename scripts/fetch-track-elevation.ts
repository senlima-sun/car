#!/usr/bin/env bun

import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { CircuitConfigFile } from './circuits/_schema'
import {
  bboxToWorldGrid,
  encodeSidecar,
  gridToHeightmap,
  validateHeightmap,
  type DatumName,
  type DemName,
  type ElevationGrid,
  type Landmark,
  type ProviderName,
  type TerrainSidecar,
} from './lib/elevation'
import { fetchWithCacheAndFallback, pickProviderFromEnv } from './lib/elevation/fetch'
import { gpsToWorld } from './lib/osm-ingest/chaining'

const TERRAIN_RESOLUTION = 256
const TERRAIN_WORLD_SIZE = 4000
const SOURCE_GRID_COLS = 128
const SOURCE_GRID_ROWS = 128

interface CircuitElevationExpectation {
  rangeMeters: number
  landmarks?: Landmark[]
}

const EXPECTATIONS: Record<string, CircuitElevationExpectation> = {
  spa: { rangeMeters: 102 },
  baku: { rangeMeters: 30 },
  catalunya: { rangeMeters: 30 },
  cota: { rangeMeters: 41 },
  hungaroring: { rangeMeters: 36 },
  imola: { rangeMeters: 40 },
  interlagos: { rangeMeters: 43 },
  'las-vegas': { rangeMeters: 5 },
  losail: { rangeMeters: 10 },
  melbourne: { rangeMeters: 10 },
  'mexico-city': { rangeMeters: 30 },
  monaco: { rangeMeters: 42 },
  montreal: { rangeMeters: 12 },
  'red-bull-ring': { rangeMeters: 65 },
  singapore: { rangeMeters: 7 },
  'yas-marina': { rangeMeters: 8 },
  zandvoort: { rangeMeters: 16 },
  silverstone: { rangeMeters: 12 },
  suzuka: { rangeMeters: 40 },
  shanghai: { rangeMeters: 10 },
  monza: { rangeMeters: 5 },
  madrid: { rangeMeters: 10 },
  miami: { rangeMeters: 5 },
}

async function resolveConfig(name: string): Promise<CircuitConfigFile> {
  const configPath = `scripts/circuits/${name}.config.json`
  const file = Bun.file(configPath)
  if (!(await file.exists())) {
    process.stderr.write(`fetch-track-elevation: no config at ${configPath}\n`)
    process.exit(1)
  }
  return (await file.json()) as CircuitConfigFile
}

function resolveFrame(config: CircuitConfigFile): {
  mode: 'osm' | 'georef' | 'flat'
  centerLat?: number
  centerLon?: number
  halfExtentMeters?: number
  headingDeg?: number
  scaleMetersPerUnit?: number
} {
  if (config.provenance === 'osm') {
    if (!config.centerLat || !config.centerLon) {
      throw new Error(`${config.name}: OSM config missing centerLat/centerLon`)
    }
    if (!config.terrainBBox) {
      throw new Error(`${config.name}: OSM config missing terrainBBox.halfExtentMeters`)
    }
    return {
      mode: 'osm',
      centerLat: config.centerLat,
      centerLon: config.centerLon,
      halfExtentMeters: config.terrainBBox.halfExtentMeters,
    }
  }

  if (!config.terrainGeoref) {
    throw new Error(
      `${config.name}: manual circuit must set terrainGeoref ({mode:"georef",...} or {mode:"flat"})`
    )
  }
  if (config.terrainGeoref.mode === 'flat') return { mode: 'flat' }
  return {
    mode: 'georef',
    centerLat: config.terrainGeoref.centerLat,
    centerLon: config.terrainGeoref.centerLon,
    halfExtentMeters: config.terrainGeoref.halfExtentMeters,
    headingDeg: config.terrainGeoref.headingDeg,
    scaleMetersPerUnit: config.terrainGeoref.scaleMetersPerUnit,
  }
}

async function assertFrameAlignment(
  config: CircuitConfigFile,
  centerLat: number,
  centerLon: number,
  halfExtentMeters: number
): Promise<void> {
  if (config.provenance !== 'osm') return
  const runtimeFile = `apps/game/src/constants/tracks/sources/${config.name}.json`
  const file = Bun.file(runtimeFile)
  if (!(await file.exists())) {
    process.stderr.write(
      `warning: runtime track ${runtimeFile} not found — skipping frame-alignment assert\n`
    )
    return
  }
  const runtime = (await file.json()) as {
    paths: Array<{ anchors: Array<{ point: { x: number; y: number } }> }>
  }
  let maxAbs = 0
  for (const path of runtime.paths) {
    for (const a of path.anchors) {
      maxAbs = Math.max(maxAbs, Math.abs(a.point.x), Math.abs(a.point.y))
    }
  }
  const expected = gpsToWorld(centerLat, centerLon, centerLat, centerLon)
  if (Math.abs(expected.x) > 0.01 || Math.abs(expected.z) > 0.01) {
    throw new Error(`gpsToWorld(center) != (0,0): ${JSON.stringify(expected)}`)
  }
  if (maxAbs > halfExtentMeters) {
    throw new Error(
      `terrain frame mismatch: track anchors reach ${maxAbs.toFixed(0)}m but terrain halfExtent is only ${halfExtentMeters}m — increase terrainBBox.halfExtentMeters`
    )
  }
}

function sampleLikeStore(
  data: Float32Array,
  resolution: number,
  worldSize: number
): (worldX: number, worldZ: number) => number {
  return (worldX, worldZ) => {
    const halfSize = worldSize / 2
    const cellSize = worldSize / (resolution - 1)
    const fx = (worldX + halfSize) / cellSize
    const fz = (worldZ + halfSize) / cellSize
    if (fx < 0 || fx >= resolution - 1 || fz < 0 || fz >= resolution - 1) return 0
    const gx = Math.floor(fx)
    const gz = Math.floor(fz)
    const tx = fx - gx
    const tz = fz - gz
    const h00 = data[gz * resolution + gx]!
    const h10 = data[gz * resolution + gx + 1]!
    const h01 = data[(gz + 1) * resolution + gx]!
    const h11 = data[(gz + 1) * resolution + gx + 1]!
    const h0 = h00 + (h10 - h00) * tx
    const h1 = h01 + (h11 - h01) * tx
    return h0 + (h1 - h0) * tz
  }
}

async function fetchSourceGridForGeoref(args: {
  centerLat: number
  centerLon: number
  halfExtentMeters: number
}): Promise<ElevationGrid> {
  const bbox = bboxToWorldGrid({
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    halfExtentMeters: args.halfExtentMeters,
  })
  const { primary, fallback, allowNetwork } = pickProviderFromEnv(process.env)
  return fetchWithCacheAndFallback({
    south: bbox.south,
    north: bbox.north,
    west: bbox.west,
    east: bbox.east,
    targetCols: SOURCE_GRID_COLS,
    targetRows: SOURCE_GRID_ROWS,
    primary,
    fallback,
    allowNetwork,
    log: (line) => process.stdout.write(`  ${line}\n`),
  })
}

function geometricCenterHeight(grid: ElevationGrid): number {
  const cx = Math.floor(grid.cols / 2)
  const cy = Math.floor(grid.rows / 2)
  return grid.data[cy * grid.cols + cx]!
}

function buildFlatSidecar(centerLat: number, centerLon: number): TerrainSidecar {
  const data = new Float32Array(TERRAIN_RESOLUTION * TERRAIN_RESOLUTION)
  return encodeSidecar({
    data,
    resolution: TERRAIN_RESOLUTION,
    worldSize: TERRAIN_WORLD_SIZE,
    verticalOriginMeters: 0,
    centerLat,
    centerLon,
    halfExtentMeters: TERRAIN_WORLD_SIZE / 2,
    provider: 'none',
    dem: 'flat',
    datum: 'flat',
  })
}

async function buildOsmSidecar(args: {
  config: CircuitConfigFile
  centerLat: number
  centerLon: number
  halfExtentMeters: number
}): Promise<{ sidecar: TerrainSidecar; report: ReturnType<typeof validateHeightmap> }> {
  await assertFrameAlignment(args.config, args.centerLat, args.centerLon, args.halfExtentMeters)
  const source = await fetchSourceGridForGeoref({
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    halfExtentMeters: args.halfExtentMeters,
  })
  const verticalOriginMeters = geometricCenterHeight(source)
  const heightmap = gridToHeightmap({
    source,
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    resolution: TERRAIN_RESOLUTION,
    worldSize: TERRAIN_WORLD_SIZE,
    verticalOriginMeters,
  })
  const expectation = EXPECTATIONS[args.config.name] ?? { rangeMeters: 30 }
  const report = validateHeightmap({
    heightmap: heightmap.data,
    resolution: TERRAIN_RESOLUTION,
    worldSize: TERRAIN_WORLD_SIZE,
    sampleAt: sampleLikeStore(heightmap.data, TERRAIN_RESOLUTION, TERRAIN_WORLD_SIZE),
    options: {
      expectedRangeMeters: expectation.rangeMeters,
      landmarks: expectation.landmarks,
    },
  })
  const sidecar = encodeSidecar({
    data: heightmap.data,
    resolution: TERRAIN_RESOLUTION,
    worldSize: TERRAIN_WORLD_SIZE,
    verticalOriginMeters,
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    halfExtentMeters: args.halfExtentMeters,
    provider: source.provider as ProviderName,
    dem: source.dem as DemName,
    datum: source.datum as DatumName,
  })
  return { sidecar, report }
}

async function writeSidecar(name: string, sidecar: TerrainSidecar): Promise<string> {
  const dir = 'apps/game/src/constants/tracks/sources/_terrain'
  await fs.mkdir(dir, { recursive: true })
  const out = path.join(dir, `${name}.heightmap.json`)
  await fs.writeFile(out, JSON.stringify(sidecar))
  return out
}

async function main(): Promise<void> {
  const name = process.argv[2]
  if (!name) {
    process.stderr.write('Usage: bun run track:elevation:fetch <circuit-name>\n')
    process.exit(1)
  }
  const config = await resolveConfig(name.toLowerCase())
  const frame = resolveFrame(config)

  if (frame.mode === 'flat') {
    process.stdout.write(`${config.displayName}: writing flat sidecar (terrainGeoref.mode=flat)\n`)
    const sidecar = buildFlatSidecar(0, 0)
    const out = await writeSidecar(config.name, sidecar)
    process.stdout.write(`  wrote ${out}\n`)
    return
  }

  process.stdout.write(`${config.displayName}: fetching elevation...\n`)
  const { sidecar, report } = await buildOsmSidecar({
    config,
    centerLat: frame.centerLat!,
    centerLon: frame.centerLon!,
    halfExtentMeters: frame.halfExtentMeters!,
  })

  process.stdout.write(
    `  range=${report.observedRange.toFixed(1)}m (min=${report.observedMin.toFixed(
      1
    )}m max=${report.observedMax.toFixed(1)}m) provider=${sidecar.provider}\n`
  )
  if (!report.pass) {
    process.stderr.write(`  validation FAILED:\n`)
    for (const r of report.reasons) process.stderr.write(`    - ${r}\n`)
    process.exit(2)
  }
  const out = await writeSidecar(config.name, sidecar)
  process.stdout.write(`  wrote ${out}\n`)
}

main().catch((err) => {
  process.stderr.write(`fetch-track-elevation: ${(err as Error).message}\n`)
  process.exit(1)
})
