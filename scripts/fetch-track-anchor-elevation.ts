#!/usr/bin/env node
/**
 * Phase 1.2 of satellite-truth-ingest. Walks every anchor of a track's
 * paths, queries Mapbox Terrain-RGB, and writes the elevation into
 * anchor.elevation (circuit-local frame). Mutates the track JSON in
 * place via tmp+rename atomic write.
 *
 * Usage: pnpm tsx scripts/fetch-track-anchor-elevation.ts <circuit-name>
 *   <circuit-name> is the name without "f1_" prefix and ".json", e.g. "spa", "red-bull-ring".
 */
import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'

import { sampleAnchorElevations } from './lib/elevation/anchorSampler'
import { MapboxTerrainRgbProvider } from './lib/elevation/providers/mapbox-terrain-rgb'

loadEnv()
loadEnv({ path: '.env.local', override: true })

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: pnpm tsx scripts/fetch-track-anchor-elevation.ts <circuit-name>')
  process.exit(2)
}
const token = process.env.MAPBOX_TOKEN
if (!token) {
  console.error('✗ MAPBOX_TOKEN missing from .env / .env.local')
  process.exit(2)
}

const trackPath = `apps/game/src/constants/tracks/sources/${arg}.json`
const configPath = `scripts/circuits/${arg}.config.json`

const track = JSON.parse(readFileSync(trackPath, 'utf8')) as {
  paths: Array<{
    anchors: Array<{ point: { x: number; y: number }; elevation?: number }>
    elevationSource?: string
  }>
}
const circuitConfig = JSON.parse(readFileSync(configPath, 'utf8')) as {
  centerLat: number
  centerLon: number
}
const config = { centerLat: circuitConfig.centerLat, centerLon: circuitConfig.centerLon }

const provider = new MapboxTerrainRgbProvider({ apiKey: token })

console.log(`Sampling Mapbox Terrain-RGB for ${arg}…`)
const start = Date.now()
const result = await sampleAnchorElevations({ paths: track.paths, config, provider })
const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(
  `  ${result.anchorCount} anchors sampled in ${elapsed}s, circuit-local origin = ${result.centerpointElevation.toFixed(1)}m abs`,
)

// Atomic write: stage in .tmp, rename in.
const serialised = JSON.stringify(track, null, 2) + '\n'
const tmp = `${trackPath}.tmp`
writeFileSync(tmp, serialised)
renameSync(tmp, trackPath)
console.log(`  wrote ${trackPath}`)
