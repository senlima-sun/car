import { promises as fs, existsSync } from 'node:fs'
import path from 'node:path'

import type { CircuitConfigFile } from './circuits/_schema'
import {
  bboxToWorldGrid,
  encodeSidecar,
  geometricCenterHeight,
  gridToHeightmap,
  sampleHeightmapLikeStore,
  validateHeightmap,
  type ElevationGrid,
  type Landmark,
  type TerrainSidecar,
} from './lib/elevation'
import { fetchWithCacheAndFallback, pickProviderFromEnv } from './lib/elevation/fetch'
import { gpsToWorld } from './lib/osm-ingest/chaining'

const TERRAIN_RESOLUTION = 256
const TERRAIN_WORLD_SIZE = 4000
const TERRAIN_HALF_SIZE = TERRAIN_WORLD_SIZE / 2
const SOURCE_BBOX_OVERFETCH_METERS = 100
const SOURCE_GRID_COLS = 128
const SOURCE_GRID_ROWS = 128
const DEFAULT_EXPECTED_RANGE_M = 30

interface CircuitElevationExpectation {
  rangeMeters: number
  landmarks?: Landmark[]
}

const EXPECTATIONS: Record<string, CircuitElevationExpectation> = {
  spa: { rangeMeters: 199 },
  baku: { rangeMeters: 95 },
  catalunya: { rangeMeters: 94 },
  cota: { rangeMeters: 53 },
  hungaroring: { rangeMeters: 154 },
  imola: { rangeMeters: 152 },
  interlagos: { rangeMeters: 75 },
  'las-vegas': { rangeMeters: 73 },
  losail: { rangeMeters: 17 },
  melbourne: { rangeMeters: 45 },
  'mexico-city': { rangeMeters: 21 },
  monaco: { rangeMeters: 603 },
  montreal: { rangeMeters: 34 },
  'red-bull-ring': { rangeMeters: 440 },
  singapore: { rangeMeters: 100 },
  'yas-marina': { rangeMeters: 16 },
  zandvoort: { rangeMeters: 21 },
  silverstone: { rangeMeters: 12 },
  suzuka: { rangeMeters: 40 },
  shanghai: { rangeMeters: 10 },
  monza: { rangeMeters: 5 },
  madrid: { rangeMeters: 10 },
  miami: { rangeMeters: 5 },
}

async function resolveConfig(name: string): Promise<CircuitConfigFile> {
  const configPath = `scripts/circuits/${name}.config.json`
  if (!existsSync(configPath)) {
    process.stderr.write(`fetch-track-elevation: no config at ${configPath}\n`)
    process.exit(1)
  }
  return JSON.parse(await fs.readFile(configPath, 'utf8')) as CircuitConfigFile
}

type Frame =
  | { mode: 'flat' }
  | { mode: 'osm'; centerLat: number; centerLon: number; halfExtentMeters: number }
  | {
      mode: 'georef'
      centerLat: number
      centerLon: number
      halfExtentMeters: number
      headingDeg: number
      scaleMetersPerUnit: number
    }

function resolveFrame(config: CircuitConfigFile): Frame {
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
  if (!existsSync(runtimeFile)) {
    process.stderr.write(
      `warning: runtime track ${runtimeFile} not found — skipping frame-alignment assert\n`
    )
    return
  }
  const runtime = JSON.parse(await fs.readFile(runtimeFile, 'utf8')) as {
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

async function fetchSourceGridForGeoref(args: {
  centerLat: number
  centerLon: number
  halfExtentMeters: number
}): Promise<ElevationGrid> {
  const sourceHalfExtent = Math.max(
    args.halfExtentMeters,
    TERRAIN_HALF_SIZE + SOURCE_BBOX_OVERFETCH_METERS,
  )
  const bbox = bboxToWorldGrid({
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    halfExtentMeters: sourceHalfExtent,
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

function buildFlatSidecar(): TerrainSidecar {
  const data = new Float32Array(TERRAIN_RESOLUTION * TERRAIN_RESOLUTION)
  const { sidecar } = encodeSidecar({
    data,
    resolution: TERRAIN_RESOLUTION,
    worldSize: TERRAIN_WORLD_SIZE,
    verticalOriginMeters: 0,
    centerLat: 0,
    centerLon: 0,
    halfExtentMeters: TERRAIN_HALF_SIZE,
    provider: 'none',
    dem: 'flat',
    datum: 'flat',
  })
  return sidecar
}

interface BuiltOsmSidecar {
  sidecar: TerrainSidecar
  clampedCells: number
  report: ReturnType<typeof validateHeightmap>
}

async function buildOsmSidecar(args: {
  config: CircuitConfigFile
  centerLat: number
  centerLon: number
  halfExtentMeters: number
  headingDeg?: number
  scaleMetersPerUnit?: number
}): Promise<BuiltOsmSidecar> {
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
    headingDeg: args.headingDeg,
    scaleMetersPerUnit: args.scaleMetersPerUnit,
  })
  const expectation = EXPECTATIONS[args.config.name] ?? { rangeMeters: DEFAULT_EXPECTED_RANGE_M }
  const report = validateHeightmap({
    heightmap: heightmap.data,
    resolution: TERRAIN_RESOLUTION,
    worldSize: TERRAIN_WORLD_SIZE,
    sampleAt: (worldX, worldZ) => sampleHeightmapLikeStore(heightmap, worldX, worldZ),
    options: {
      expectedRangeMeters: expectation.rangeMeters,
      landmarks: expectation.landmarks,
    },
  })
  const { sidecar, clampedCells } = encodeSidecar({
    data: heightmap.data,
    resolution: TERRAIN_RESOLUTION,
    worldSize: TERRAIN_WORLD_SIZE,
    verticalOriginMeters,
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    halfExtentMeters: args.halfExtentMeters,
    provider: source.provider,
    dem: source.dem,
    datum: source.datum,
    clampOutOfRange: true,
  })
  return { sidecar, clampedCells, report }
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
    process.stderr.write('Usage: pnpm run track:elevation:fetch <circuit-name>\n')
    process.exit(1)
  }
  const config = await resolveConfig(name.toLowerCase())
  const frame = resolveFrame(config)

  if (frame.mode === 'flat') {
    process.stdout.write(`${config.displayName}: writing flat sidecar (terrainGeoref.mode=flat)\n`)
    const sidecar = buildFlatSidecar()
    const out = await writeSidecar(config.name, sidecar)
    process.stdout.write(`  wrote ${out}\n`)
    return
  }

  process.stdout.write(`${config.displayName}: fetching elevation...\n`)
  if (frame.mode === 'georef') {
    process.stdout.write(
      `  georef: heading=${frame.headingDeg}° scale=${frame.scaleMetersPerUnit}m/unit\n`
    )
  }
  const { sidecar, clampedCells, report } = await buildOsmSidecar({
    config,
    centerLat: frame.centerLat,
    centerLon: frame.centerLon,
    halfExtentMeters: frame.halfExtentMeters,
    headingDeg: frame.mode === 'georef' ? frame.headingDeg : undefined,
    scaleMetersPerUnit: frame.mode === 'georef' ? frame.scaleMetersPerUnit : undefined,
  })

  const totalCells = TERRAIN_RESOLUTION * TERRAIN_RESOLUTION
  const clampNote = clampedCells > 0 ? ` clampedCells=${clampedCells}/${totalCells}` : ''
  const rangeSummary = `range=${report.observedRange.toFixed(1)}m (min=${report.observedMin.toFixed(1)}m max=${report.observedMax.toFixed(1)}m)`
  process.stdout.write(`  ${rangeSummary} provider=${sidecar.provider}${clampNote}\n`)
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
