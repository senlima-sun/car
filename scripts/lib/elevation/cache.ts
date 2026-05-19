import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { ElevationGrid, ProviderName } from './provider'

export interface ElevationCacheKey {
  provider: ProviderName
  south: number
  north: number
  west: number
  east: number
  targetCols: number
  targetRows: number
}

const CACHE_DIR = path.resolve(process.cwd(), 'scripts/.cache/elevation')

export function computeCacheKey(key: ElevationCacheKey): string {
  const canonical = JSON.stringify({
    provider: key.provider,
    south: round6(key.south),
    north: round6(key.north),
    west: round6(key.west),
    east: round6(key.east),
    targetCols: key.targetCols,
    targetRows: key.targetRows,
  })
  return createHash('sha1').update(canonical).digest('hex').slice(0, 16)
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6
}

interface SerialisedGrid {
  south: number
  north: number
  west: number
  east: number
  cols: number
  rows: number
  provider: ElevationGrid['provider']
  dem: ElevationGrid['dem']
  datum: ElevationGrid['datum']
  data: string
}

export async function readCache(
  key: ElevationCacheKey
): Promise<ElevationGrid | null> {
  const file = cacheFilePath(key)
  try {
    const raw = await fs.readFile(file, 'utf8')
    const parsed = JSON.parse(raw) as SerialisedGrid
    const buf = Buffer.from(parsed.data, 'base64')
    const floats = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    return {
      south: parsed.south,
      north: parsed.north,
      west: parsed.west,
      east: parsed.east,
      cols: parsed.cols,
      rows: parsed.rows,
      provider: parsed.provider,
      dem: parsed.dem,
      datum: parsed.datum,
      data: new Float32Array(floats),
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function writeCache(key: ElevationCacheKey, grid: ElevationGrid): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const file = cacheFilePath(key)
  const bytes = Buffer.from(grid.data.buffer, grid.data.byteOffset, grid.data.byteLength)
  const payload: SerialisedGrid = {
    south: grid.south,
    north: grid.north,
    west: grid.west,
    east: grid.east,
    cols: grid.cols,
    rows: grid.rows,
    provider: grid.provider,
    dem: grid.dem,
    datum: grid.datum,
    data: bytes.toString('base64'),
  }
  await fs.writeFile(file, JSON.stringify(payload))
}

function cacheFilePath(key: ElevationCacheKey): string {
  return path.join(CACHE_DIR, `${key.provider}-${computeCacheKey(key)}.json`)
}
