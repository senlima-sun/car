import type { ElevationGrid, ElevationProvider } from '../provider'
import { ProviderError } from '../provider'

const ENDPOINT = 'https://api.open-elevation.com/api/v1/lookup'
const TIMEOUT_MS = 30_000
const MAX_POINTS_PER_REQUEST = 200

export class OpenElevationProvider implements ElevationProvider {
  readonly name = 'open-elevation' as const
  readonly dem = 'SRTM' as const
  readonly datum = 'EGM2008' as const

  async fetch(args: {
    south: number
    north: number
    west: number
    east: number
    targetCols: number
    targetRows: number
  }): Promise<ElevationGrid> {
    const { south, north, west, east, targetCols, targetRows } = args
    const locations: Array<{ latitude: number; longitude: number }> = []
    for (let y = 0; y < targetRows; y++) {
      const lat = north - ((north - south) * y) / (targetRows - 1)
      for (let x = 0; x < targetCols; x++) {
        const lon = west + ((east - west) * x) / (targetCols - 1)
        locations.push({ latitude: lat, longitude: lon })
      }
    }
    const data = new Float32Array(locations.length)
    for (let i = 0; i < locations.length; i += MAX_POINTS_PER_REQUEST) {
      const batch = locations.slice(i, i + MAX_POINTS_PER_REQUEST)
      const results = await this.fetchBatch(batch)
      for (let j = 0; j < results.length; j++) data[i + j] = results[j]!
    }
    return {
      south,
      north,
      west,
      east,
      cols: targetCols,
      rows: targetRows,
      data,
      provider: 'open-elevation',
      dem: 'SRTM',
      datum: 'EGM2008',
    }
  }

  private async fetchBatch(
    locations: Array<{ latitude: number; longitude: number }>
  ): Promise<number[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const retryable = res.status >= 500 && res.status < 600
        throw new ProviderError(`Open-Elevation ${res.status}`, { retryable, status: res.status })
      }
      const json = (await res.json()) as { results: Array<{ elevation: number }> }
      return json.results.map((r) =>
        Number.isFinite(r.elevation) && r.elevation > -1000 && r.elevation < 9000 ? r.elevation : 0
      )
    } catch (err) {
      if (err instanceof ProviderError) throw err
      if ((err as { name?: string }).name === 'AbortError') {
        throw new ProviderError('Open-Elevation timeout', { retryable: true })
      }
      throw new ProviderError(
        `Open-Elevation network error: ${(err as Error).message}`,
        { retryable: true }
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
