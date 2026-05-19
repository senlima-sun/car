import { fromArrayBuffer } from 'geotiff'

import type { ElevationGrid, ElevationProvider } from '../provider'
import { ProviderError } from '../provider'

const ENDPOINT = 'https://portal.opentopography.org/API/globaldem'
const DEM_TYPE = 'COP30'
const TIMEOUT_MS = 30_000

export class OpenTopographyProvider implements ElevationProvider {
  readonly name = 'opentopography-cop30' as const
  readonly dem = 'GLO-30' as const
  readonly datum = 'EGM2008' as const

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error('OpenTopographyProvider requires an API key')
  }

  async fetch(args: {
    south: number
    north: number
    west: number
    east: number
    targetCols: number
    targetRows: number
  }): Promise<ElevationGrid> {
    const params = new URLSearchParams({
      demtype: DEM_TYPE,
      south: args.south.toFixed(6),
      north: args.north.toFixed(6),
      west: args.west.toFixed(6),
      east: args.east.toFixed(6),
      outputFormat: 'GTiff',
      API_Key: this.apiKey,
    })
    const url = `${ENDPOINT}?${params.toString()}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        const retryable = res.status >= 500 && res.status < 600
        const text = await res.text().catch(() => '')
        throw new ProviderError(
          `OpenTopography ${res.status}: ${text.slice(0, 200)}`,
          { retryable, status: res.status }
        )
      }
      const buf = await res.arrayBuffer()
      return parseGeoTiff(buf)
    } catch (err) {
      if (err instanceof ProviderError) throw err
      if ((err as { name?: string }).name === 'AbortError') {
        throw new ProviderError('OpenTopography timeout', { retryable: true })
      }
      throw new ProviderError(
        `OpenTopography network error: ${(err as Error).message}`,
        { retryable: true }
      )
    } finally {
      clearTimeout(timer)
    }
  }
}

async function parseGeoTiff(buf: ArrayBuffer): Promise<ElevationGrid> {
  const tiff = await fromArrayBuffer(buf)
  const image = await tiff.getImage()
  const width = image.getWidth()
  const height = image.getHeight()
  const [west, south, east, north] = image.getBoundingBox() as [number, number, number, number]
  const rasters = await image.readRasters()
  const raw = (rasters as unknown as Array<ArrayLike<number>>)[0]
  if (!raw) throw new ProviderError('OpenTopography returned empty raster', { retryable: false })
  const data = new Float32Array(width * height)
  let nodataCount = 0
  for (let i = 0; i < data.length; i++) {
    const v = Number(raw[i])
    if (!Number.isFinite(v) || v < -1000 || v > 9000) {
      data[i] = 0
      nodataCount++
    } else {
      data[i] = v
    }
  }
  if (nodataCount > data.length * 0.5) {
    throw new ProviderError(
      `OpenTopography returned >50% nodata cells (${nodataCount}/${data.length})`,
      { retryable: false }
    )
  }
  return {
    south,
    north,
    west,
    east,
    cols: width,
    rows: height,
    data,
    provider: 'opentopography-cop30',
    dem: 'GLO-30',
    datum: 'EGM2008',
  }
}
