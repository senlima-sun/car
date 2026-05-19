import { METERS_PER_DEG_LAT, metersPerDegLon } from '../osm-ingest/chaining'
import type { ElevationGrid } from './provider'

export interface TerrainHeightmap {
  resolution: number
  worldSize: number
  data: Float32Array
}

export interface BboxToWorldGridResult {
  centerLat: number
  centerLon: number
  halfExtentMeters: number
  south: number
  north: number
  west: number
  east: number
}

export function bboxToWorldGrid(args: {
  centerLat: number
  centerLon: number
  halfExtentMeters: number
}): BboxToWorldGridResult {
  const { centerLat, centerLon, halfExtentMeters } = args
  const dLat = halfExtentMeters / METERS_PER_DEG_LAT
  const dLon = halfExtentMeters / metersPerDegLon(centerLat)
  return {
    centerLat,
    centerLon,
    halfExtentMeters,
    south: centerLat - dLat,
    north: centerLat + dLat,
    west: centerLon - dLon,
    east: centerLon + dLon,
  }
}

function bilinearSampleSource(grid: ElevationGrid, lat: number, lon: number): number | null {
  const { south, north, west, east, cols, rows, data } = grid
  const tx = ((lon - west) / (east - west)) * (cols - 1)
  const tyFromNorth = ((north - lat) / (north - south)) * (rows - 1)
  if (tx < 0 || tx > cols - 1 || tyFromNorth < 0 || tyFromNorth > rows - 1) return null
  const x0 = Math.floor(tx)
  const y0 = Math.floor(tyFromNorth)
  const x1 = Math.min(cols - 1, x0 + 1)
  const y1 = Math.min(rows - 1, y0 + 1)
  const fx = tx - x0
  const fy = tyFromNorth - y0
  const h00 = data[y0 * cols + x0]!
  const h10 = data[y0 * cols + x1]!
  const h01 = data[y1 * cols + x0]!
  const h11 = data[y1 * cols + x1]!
  const h0 = h00 + (h10 - h00) * fx
  const h1 = h01 + (h11 - h01) * fx
  return h0 + (h1 - h0) * fy
}

export function gridToHeightmap(args: {
  source: ElevationGrid
  centerLat: number
  centerLon: number
  resolution: number
  worldSize: number
  verticalOriginMeters: number
  headingDeg?: number
  scaleMetersPerUnit?: number
}): TerrainHeightmap {
  const {
    source,
    centerLat,
    centerLon,
    resolution,
    worldSize,
    verticalOriginMeters,
    headingDeg = 0,
    scaleMetersPerUnit = 1,
  } = args
  const halfSize = worldSize / 2
  const cellSize = worldSize / (resolution - 1)
  const lonScale = metersPerDegLon(centerLat)
  const headingRad = (headingDeg * Math.PI) / 180
  const cosH = Math.cos(headingRad)
  const sinH = Math.sin(headingRad)
  const data = new Float32Array(resolution * resolution)
  for (let gz = 0; gz < resolution; gz++) {
    const localZ = (-halfSize + gz * cellSize) * scaleMetersPerUnit
    for (let gx = 0; gx < resolution; gx++) {
      const localX = (-halfSize + gx * cellSize) * scaleMetersPerUnit
      const realX = localX * cosH - localZ * sinH
      const realZ = localX * sinH + localZ * cosH
      const lat = centerLat - realZ / METERS_PER_DEG_LAT
      const lon = centerLon + realX / lonScale
      const sampled = bilinearSampleSource(source, lat, lon)
      data[gz * resolution + gx] = sampled === null ? 0 : sampled - verticalOriginMeters
    }
  }
  return { resolution, worldSize, data }
}

export function geometricCenterHeight(grid: ElevationGrid): number {
  const cx = Math.floor(grid.cols / 2)
  const cy = Math.floor(grid.rows / 2)
  return grid.data[cy * grid.cols + cx]!
}

export function sampleHeightmapLikeStore(
  heightmap: TerrainHeightmap,
  worldX: number,
  worldZ: number
): number {
  const { data, resolution, worldSize } = heightmap
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
