import { describe, expect, test } from 'bun:test'

import { METERS_PER_DEG_LAT } from '../osm-ingest/chaining'
import type { ElevationGrid } from './provider'
import { bboxToWorldGrid, gridToHeightmap, sampleHeightmapLikeStore } from './grid'

function makeSyntheticSource(args: {
  centerLat: number
  centerLon: number
  halfExtentMeters: number
  cols: number
  rows: number
  heightAt: (lat: number, lon: number) => number
}): ElevationGrid {
  const bbox = bboxToWorldGrid({
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    halfExtentMeters: args.halfExtentMeters,
  })
  const data = new Float32Array(args.cols * args.rows)
  for (let y = 0; y < args.rows; y++) {
    const lat = bbox.north - ((bbox.north - bbox.south) * y) / (args.rows - 1)
    for (let x = 0; x < args.cols; x++) {
      const lon = bbox.west + ((bbox.east - bbox.west) * x) / (args.cols - 1)
      data[y * args.cols + x] = args.heightAt(lat, lon)
    }
  }
  return {
    south: bbox.south,
    north: bbox.north,
    west: bbox.west,
    east: bbox.east,
    cols: args.cols,
    rows: args.rows,
    data,
    provider: 'opentopography-cop30',
    dem: 'GLO-30',
    datum: 'EGM2008',
  }
}

describe('bboxToWorldGrid', () => {
  test('produces symmetric lat/lon bounds about center', () => {
    const result = bboxToWorldGrid({
      centerLat: 50.4372,
      centerLon: 5.9714,
      halfExtentMeters: 1300,
    })
    expect(result.south).toBeLessThan(result.centerLat)
    expect(result.north).toBeGreaterThan(result.centerLat)
    expect(result.west).toBeLessThan(result.centerLon)
    expect(result.east).toBeGreaterThan(result.centerLon)
    const dLat = result.north - result.centerLat
    expect(Math.abs(dLat - (result.centerLat - result.south))).toBeLessThan(1e-9)
  })
})

describe('gridToHeightmap', () => {
  test('linear east-west ramp resamples within 0.5m of analytic value', () => {
    const centerLat = 50.4372
    const centerLon = 5.9714
    const halfExtentMeters = 1300
    const metersPerDegLon = Math.cos((centerLat * Math.PI) / 180) * 111320
    const source = makeSyntheticSource({
      centerLat,
      centerLon,
      halfExtentMeters: 2100,
      cols: 64,
      rows: 64,
      heightAt: (_lat, lon) => (lon - centerLon) * metersPerDegLon * 0.01,
    })
    const heightmap = gridToHeightmap({
      source,
      centerLat,
      centerLon,
      resolution: 256,
      worldSize: 4000,
      verticalOriginMeters: 0,
    })
    const observed = sampleHeightmapLikeStore({ ...heightmap, resolution: 256, worldSize: 4000 }, 500, 0)
    expect(Math.abs(observed - 5)).toBeLessThan(0.5)
  })

  test('north-up convention: gz=0 corresponds to higher latitude than gz=resolution-1', () => {
    const centerLat = 50.4372
    const centerLon = 5.9714
    const halfExtentMeters = 1300
    const source = makeSyntheticSource({
      centerLat,
      centerLon,
      halfExtentMeters: 2100,
      cols: 64,
      rows: 64,
      heightAt: (lat, _lon) => (lat - centerLat) * METERS_PER_DEG_LAT * 0.01,
    })
    const heightmap = gridToHeightmap({
      source,
      centerLat,
      centerLon,
      resolution: 256,
      worldSize: 4000,
      verticalOriginMeters: 0,
    })
    const resolution = 256
    const midX = 128
    const topRow = heightmap.data[0 * resolution + midX]!
    const bottomRow = heightmap.data[(resolution - 1) * resolution + midX]!
    expect(topRow).toBeGreaterThan(bottomRow)
  })

  test('verticalOriginMeters shifts stored heights track-relative', () => {
    const centerLat = 19.4042
    const centerLon = -99.0907
    const halfExtentMeters = 1100
    const source = makeSyntheticSource({
      centerLat,
      centerLon,
      halfExtentMeters: 2100,
      cols: 32,
      rows: 32,
      heightAt: () => 2240,
    })
    const heightmap = gridToHeightmap({
      source,
      centerLat,
      centerLon,
      resolution: 256,
      worldSize: 4000,
      verticalOriginMeters: 2240,
    })
    for (let i = 0; i < heightmap.data.length; i++) {
      expect(Math.abs(heightmap.data[i]!)).toBeLessThan(0.001)
    }
  })

  test('georef heading=90 swaps east-west and north-south sampling', () => {
    const centerLat = 50
    const centerLon = 0
    const source = makeSyntheticSource({
      centerLat,
      centerLon,
      halfExtentMeters: 2100,
      cols: 64,
      rows: 64,
      heightAt: (lat, _lon) => (lat - centerLat) * METERS_PER_DEG_LAT * 0.01,
    })
    const heightmapStraight = gridToHeightmap({
      source,
      centerLat,
      centerLon,
      resolution: 64,
      worldSize: 4000,
      verticalOriginMeters: 0,
    })
    const heightmapRotated90 = gridToHeightmap({
      source,
      centerLat,
      centerLon,
      resolution: 64,
      worldSize: 4000,
      verticalOriginMeters: 0,
      headingDeg: 90,
    })
    const resolution = 64
    const midRow = Math.floor(resolution / 2)
    const midCol = Math.floor(resolution / 2)
    const straightNS = heightmapStraight.data[0 * resolution + midCol]!
    const rotatedEW = heightmapRotated90.data[midRow * resolution + 0]!
    expect(Math.abs(straightNS - rotatedEW)).toBeLessThan(1)
  })

  test('smooth source produces no stepping (adjacent cell delta bounded)', () => {
    const centerLat = 50.4372
    const centerLon = 5.9714
    const halfExtentMeters = 1300
    const metersPerDegLon = Math.cos((centerLat * Math.PI) / 180) * 111320
    const source = makeSyntheticSource({
      centerLat,
      centerLon,
      halfExtentMeters: 2100,
      cols: 64,
      rows: 64,
      heightAt: (_lat, lon) => (lon - centerLon) * metersPerDegLon * 0.02,
    })
    const heightmap = gridToHeightmap({
      source,
      centerLat,
      centerLon,
      resolution: 256,
      worldSize: 4000,
      verticalOriginMeters: 0,
    })
    const cellSizeM = 4000 / 255
    const expectedAdjacentDelta = cellSizeM * 0.02
    let maxObservedDelta = 0
    for (let gz = 100; gz < 156; gz++) {
      for (let gx = 100; gx < 155; gx++) {
        const a = heightmap.data[gz * 256 + gx]!
        const b = heightmap.data[gz * 256 + gx + 1]!
        maxObservedDelta = Math.max(maxObservedDelta, Math.abs(a - b))
      }
    }
    expect(maxObservedDelta).toBeLessThan(expectedAdjacentDelta * 2)
  })
})
