import sharp from 'sharp'

import type { ElevationGrid, ElevationProvider } from '../provider'
import { ProviderError } from '../provider'

const TILE_SIZE = 256
const DEFAULT_ZOOM = 14
const TIMEOUT_MS = 30_000
const TILE_URL = (z: number, x: number, y: number, token: string) =>
  `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.pngraw?access_token=${token}`

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>

export interface MapboxTerrainRgbProviderOptions {
  apiKey: string
  zoom?: number
  fetchImpl?: FetchFn
}

export class MapboxTerrainRgbProvider implements ElevationProvider {
  readonly name = 'mapbox-terrain-rgb' as const
  readonly dem = 'MAPBOX' as const
  readonly datum = 'MAPBOX_NATIVE' as const

  private readonly apiKey: string
  private readonly zoom: number
  private readonly fetchImpl: FetchFn
  private readonly tileCache = new Map<string, Promise<Uint8Array>>()

  constructor(opts: MapboxTerrainRgbProviderOptions) {
    if (!opts.apiKey) {
      throw new ProviderError(
        'MapboxTerrainRgbProvider: process.env.MAPBOX_TOKEN missing',
        { retryable: false },
      )
    }
    this.apiKey = opts.apiKey
    this.zoom = opts.zoom ?? DEFAULT_ZOOM
    this.fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i))
  }

  async fetch(args: {
    south: number
    north: number
    west: number
    east: number
    targetCols: number
    targetRows: number
  }): Promise<ElevationGrid> {
    const z = this.zoom
    const { south, north, west, east, targetCols, targetRows } = args

    // Tile range covering the bbox.
    const tileWest = lonToTileX(west, z)
    const tileEast = lonToTileX(east, z)
    const tileNorth = latToTileY(north, z)
    const tileSouth = latToTileY(south, z)
    const xMin = Math.min(tileWest, tileEast)
    const xMax = Math.max(tileWest, tileEast)
    const yMin = Math.min(tileNorth, tileSouth)
    const yMax = Math.max(tileNorth, tileSouth)

    // Decode every tile we need (in parallel, but deduped via tileCache).
    const tiles = new Map<string, Uint8Array>()
    const jobs: Array<Promise<void>> = []
    for (let ty = yMin; ty <= yMax; ty++) {
      for (let tx = xMin; tx <= xMax; tx++) {
        const key = `${z}/${tx}/${ty}`
        jobs.push(
          this.getTile(z, tx, ty).then(rgba => {
            tiles.set(key, rgba)
          }),
        )
      }
    }
    await Promise.all(jobs)

    // Output grid sampled at targetCols × targetRows over [west,east] × [south,north].
    const data = new Float32Array(targetCols * targetRows)
    for (let row = 0; row < targetRows; row++) {
      const lat =
        targetRows === 1
          ? south
          : north - (row * (north - south)) / (targetRows - 1)
      for (let col = 0; col < targetCols; col++) {
        const lon =
          targetCols === 1
            ? west
            : west + (col * (east - west)) / (targetCols - 1)
        data[row * targetCols + col] = bilinearSampleAtLatLon(
          lat,
          lon,
          z,
          tiles,
        )
      }
    }

    return {
      south,
      north,
      west,
      east,
      cols: targetCols,
      rows: targetRows,
      data,
      provider: 'mapbox-terrain-rgb',
      dem: 'MAPBOX',
      datum: 'MAPBOX_NATIVE',
    }
  }

  /**
   * Sample a single (lat, lon) point. Higher-precision than going through
   * fetch() when only a handful of points are needed (e.g. per-anchor
   * elevation sampling). Caches the underlying tile.
   */
  async sample(lat: number, lon: number): Promise<number> {
    const z = this.zoom
    const tx = lonToTileX(lon, z)
    const ty = latToTileY(lat, z)
    const tiles = new Map<string, Uint8Array>()
    tiles.set(`${z}/${tx}/${ty}`, await this.getTile(z, tx, ty))
    // Bilinear may need neighbours when the point sits on a tile edge.
    const fx = ((lon + 180) / 360) * (1 << z) * TILE_SIZE
    const fy = latToPixelY(lat, z)
    const pxBoundary = fx % TILE_SIZE
    const pyBoundary = fy % TILE_SIZE
    if (pxBoundary > TILE_SIZE - 2)
      tiles.set(`${z}/${tx + 1}/${ty}`, await this.getTile(z, tx + 1, ty))
    if (pyBoundary > TILE_SIZE - 2)
      tiles.set(`${z}/${tx}/${ty + 1}`, await this.getTile(z, tx, ty + 1))
    if (pxBoundary > TILE_SIZE - 2 && pyBoundary > TILE_SIZE - 2)
      tiles.set(`${z}/${tx + 1}/${ty + 1}`, await this.getTile(z, tx + 1, ty + 1))
    return bilinearSampleAtLatLon(lat, lon, z, tiles)
  }

  private async getTile(z: number, x: number, y: number): Promise<Uint8Array> {
    const key = `${z}/${x}/${y}`
    const cached = this.tileCache.get(key)
    if (cached) return cached
    const promise = this.fetchTile(z, x, y).catch(err => {
      this.tileCache.delete(key)
      throw err
    })
    this.tileCache.set(key, promise)
    return promise
  }

  private async fetchTile(z: number, x: number, y: number): Promise<Uint8Array> {
    const url = TILE_URL(z, x, y, this.apiKey)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal })
      if (!res.ok) {
        const retryable = res.status >= 500 && res.status < 600
        const text = await res.text().catch(() => '')
        throw new ProviderError(
          `Mapbox terrain-rgb ${res.status} for tile ${z}/${x}/${y}: ${text.slice(0, 200)}`,
          { retryable, status: res.status },
        )
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const { data, info } = await sharp(buf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      if (info.width !== TILE_SIZE || info.height !== TILE_SIZE) {
        throw new ProviderError(
          `Mapbox terrain-rgb tile ${z}/${x}/${y} unexpected size ${info.width}×${info.height}`,
          { retryable: false },
        )
      }
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    } catch (err) {
      if (err instanceof ProviderError) throw err
      if ((err as { name?: string }).name === 'AbortError') {
        throw new ProviderError(`Mapbox terrain-rgb timeout (tile ${z}/${x}/${y})`, {
          retryable: true,
        })
      }
      throw new ProviderError(
        `Mapbox terrain-rgb network error (tile ${z}/${x}/${y}): ${(err as Error).message}`,
        { retryable: true },
      )
    } finally {
      clearTimeout(timer)
    }
  }
}

export function decodeElevation(r: number, g: number, b: number): number {
  return -10000 + (r * 65536 + g * 256 + b) * 0.1
}

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * (1 << z))
}

function latToTileY(lat: number, z: number): number {
  const sin = Math.sin((lat * Math.PI) / 180)
  return Math.floor(
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * (1 << z),
  )
}

function latToPixelY(lat: number, z: number): number {
  const sin = Math.sin((lat * Math.PI) / 180)
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * (1 << z) * TILE_SIZE
}

function lonToPixelX(lon: number, z: number): number {
  return ((lon + 180) / 360) * (1 << z) * TILE_SIZE
}

function bilinearSampleAtLatLon(
  lat: number,
  lon: number,
  z: number,
  tiles: Map<string, Uint8Array>,
): number {
  const fx = lonToPixelX(lon, z)
  const fy = latToPixelY(lat, z)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx0 = Math.floor(x0 / TILE_SIZE)
  const ty0 = Math.floor(y0 / TILE_SIZE)
  const tx1 = Math.floor((x0 + 1) / TILE_SIZE)
  const ty1 = Math.floor((y0 + 1) / TILE_SIZE)
  const px0 = x0 - tx0 * TILE_SIZE
  const py0 = y0 - ty0 * TILE_SIZE
  const px1 = x0 + 1 - tx1 * TILE_SIZE
  const py1 = y0 + 1 - ty1 * TILE_SIZE
  const h00 = pixelElevation(tiles, z, tx0, ty0, px0, py0)
  const h10 = pixelElevation(tiles, z, tx1, ty0, px1, py0)
  const h01 = pixelElevation(tiles, z, tx0, ty1, px0, py1)
  const h11 = pixelElevation(tiles, z, tx1, ty1, px1, py1)
  const u = fx - x0
  const v = fy - y0
  const h0 = h00 + (h10 - h00) * u
  const h1 = h01 + (h11 - h01) * u
  return h0 + (h1 - h0) * v
}

function pixelElevation(
  tiles: Map<string, Uint8Array>,
  z: number,
  tx: number,
  ty: number,
  px: number,
  py: number,
): number {
  const key = `${z}/${tx}/${ty}`
  const rgba = tiles.get(key)
  if (!rgba) {
    throw new ProviderError(
      `Mapbox terrain-rgb internal: tile ${key} not loaded but pixel requested`,
      { retryable: false },
    )
  }
  const idx = (py * TILE_SIZE + px) * 4
  return decodeElevation(rgba[idx]!, rgba[idx + 1]!, rgba[idx + 2]!)
}
