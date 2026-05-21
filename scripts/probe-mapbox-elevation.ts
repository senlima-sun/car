#!/usr/bin/env node
/**
 * Phase 1.2.5 quality gate: verify Mapbox Terrain-RGB resolves the Spa
 * Eau Rouge climb to within [38m, 44m] (real telemetry ≈ 41m). If it
 * doesn't, the whole satellite-truth-ingest rewrite is rejected at the
 * gate — see decision row "Mapbox Terrain-RGB at zoom 14" in
 * .claude/plans/satellite-truth-ingest.md.
 *
 * Run: pnpm tsx scripts/probe-mapbox-elevation.ts
 */
import { readFileSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'

import { sampleAnchorElevations } from './lib/elevation/anchorSampler'
import { MapboxTerrainRgbProvider } from './lib/elevation/providers/mapbox-terrain-rgb'

// Load env from repo-root .env (gitignored), then .env.local override.
loadEnv()
loadEnv({ path: '.env.local', override: true })

const token = process.env.MAPBOX_TOKEN
if (!token) {
  console.error(
    '✗ MAPBOX_TOKEN missing from .env / .env.local — get one at https://account.mapbox.com/',
  )
  process.exit(2)
}

const spa = JSON.parse(
  readFileSync('apps/game/src/constants/tracks/sources/spa.json', 'utf8'),
) as { paths: Array<{ anchors: Array<{ point: { x: number; y: number } }> }> }

const config = { centerLat: 50.4372, centerLon: 5.9714 }
const provider = new MapboxTerrainRgbProvider({ apiKey: token })

console.log('Sampling Mapbox Terrain-RGB z14 for Spa-Francorchamps anchors…')
const start = Date.now()
const result = await sampleAnchorElevations({
  paths: spa.paths,
  config,
  provider,
})
const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(
  `  sampled ${result.anchorCount} anchors in ${elapsed}s, centerpoint absolute = ${result.centerpointElevation.toFixed(1)}m`,
)

// Print elevation profile of path 0 (main racing line).
const path0 = spa.paths[0]!
const elevations = path0.anchors.map(
  (a, i) => ({ i, x: a.point.x, z: a.point.y, e: (a as { elevation?: number }).elevation ?? 0 }),
)
const min = Math.min(...elevations.map(e => e.e))
const max = Math.max(...elevations.map(e => e.e))
console.log(`\nPath 0 elevation (local frame, anchored at sidecar center):`)
console.log(`  range: [${min.toFixed(2)}, ${max.toFixed(2)}] m, span = ${(max - min).toFixed(2)} m`)

// Eau Rouge: the world coord range of the climb sits roughly in
// x ∈ [-1100, -600], z ∈ [-1500, -700] for our centerLat/Lon. The user
// drives "into" the climb after La Source. Pick the lowest-elevation
// anchor inside that bbox (Eau Rouge entry) and the highest-elevation
// anchor in z ∈ [-1700, -900] (Raidillon crest). Real climb ≈ 41 m.
const eauRougeBox = elevations.filter(
  e => e.x >= -1100 && e.x <= -400 && e.z >= -1800 && e.z <= -600,
)
console.log(`\nEau Rouge / Raidillon bbox: ${eauRougeBox.length} anchors`)
if (eauRougeBox.length > 0) {
  const low = eauRougeBox.reduce((acc, e) => (e.e < acc.e ? e : acc))
  const high = eauRougeBox.reduce((acc, e) => (e.e > acc.e ? e : acc))
  const climb = high.e - low.e
  console.log(
    `  lowest anchor [${low.i}] @ (${low.x.toFixed(0)}, ${low.z.toFixed(0)}) → ${low.e.toFixed(2)} m`,
  )
  console.log(
    `  highest anchor [${high.i}] @ (${high.x.toFixed(0)}, ${high.z.toFixed(0)}) → ${high.e.toFixed(2)} m`,
  )
  console.log(`\n  Eau Rouge climb ≈ ${climb.toFixed(2)} m`)
  if (climb >= 38 && climb <= 44) {
    console.log(`  ✓ PASS — within [38, 44] m (real ≈ 41 m)`)
    process.exit(0)
  } else {
    console.log(`  ✗ FAIL — outside [38, 44] m gate`)
    process.exit(1)
  }
} else {
  console.error('  ✗ no anchors found in Eau Rouge bbox — coordinate frame mismatch?')
  process.exit(2)
}
