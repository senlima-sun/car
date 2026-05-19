import { gpsToWorld } from '../osm-ingest/chaining'
import type { ElevationGrid } from './provider'

const METERS_PER_DEG_LAT = 110540

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
  const metersPerDegLon = Math.cos((centerLat * Math.PI) / 180) * 111320
  const dLat = halfExtentMeters / METERS_PER_DEG_LAT
  const dLon = halfExtentMeters / metersPerDegLon
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

function worldToGps(
  worldX: number,
  worldZ: number,
  centerLat: number,
  centerLon: number
): { lat: number; lon: number } {
  const metersPerDegLon = Math.cos((centerLat * Math.PI) / 180) * 111320
  const lat = centerLat - worldZ / METERS_PER_DEG_LAT
  const lon = centerLon + worldX / metersPerDegLon
  return { lat, lon }
}

function bilinearSampleSource(grid: ElevationGrid, lat: number, lon: number): number {
  const { south, north, west, east, cols, rows, data } = grid
  const tx = ((lon - west) / (east - west)) * (cols - 1)
  const tyFromNorth = ((north - lat) / (north - south)) * (rows - 1)
  const cx = Math.max(0, Math.min(cols - 1, tx))
  const cy = Math.max(0, Math.min(rows - 1, tyFromNorth))
  const x0 = Math.floor(cx)
  const y0 = Math.floor(cy)
  const x1 = Math.min(cols - 1, x0 + 1)
  const y1 = Math.min(rows - 1, y0 + 1)
  const fx = cx - x0
  const fy = cy - y0
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
}): TerrainHeightmap {
  const { source, centerLat, centerLon, resolution, worldSize, verticalOriginMeters } = args
  const halfSize = worldSize / 2
  const cellSize = worldSize / (resolution - 1)
  const data = new Float32Array(resolution * resolution)
  for (let gz = 0; gz < resolution; gz++) {
    for (let gx = 0; gx < resolution; gx++) {
      const worldX = -halfSize + gx * cellSize
      const worldZ = -halfSize + gz * cellSize
      const { lat, lon } = worldToGps(worldX, worldZ, centerLat, centerLon)
      const absH = bilinearSampleSource(source, lat, lon)
      data[gz * resolution + gx] = absH - verticalOriginMeters
    }
  }
  return { resolution, worldSize, data }
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

export { gpsToWorld }
