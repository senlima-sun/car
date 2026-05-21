import { describe, expect, it } from 'bun:test'
import sharp from 'sharp'

import { MapboxTerrainRgbProvider, decodeElevation } from './mapbox-terrain-rgb'
import { ProviderError } from '../provider'

describe('decodeElevation (Mapbox terrain-rgb formula)', () => {
  it('matches published example pixels', () => {
    // From https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/
    // (R=0, G=0, B=0) → -10000 m; (R=255, G=255, B=255) → ~6710 m
    expect(decodeElevation(0, 0, 0)).toBeCloseTo(-10000, 4)
    expect(decodeElevation(255, 255, 255)).toBeCloseTo(
      -10000 + (255 * 65536 + 255 * 256 + 255) * 0.1,
      4,
    )
    // Mid-range sanity check: encoding of exactly sea level (0 m).
    // 0 = -10000 + N * 0.1 ⇒ N = 100000
    // 100000 = 1*65536 + 134*256 + 160 (verify: 65536 + 34304 + 160 = 100000)
    expect(decodeElevation(1, 134, 160)).toBeCloseTo(0, 1)
  })

  it('produces a strictly-increasing function of the packed integer', () => {
    expect(decodeElevation(1, 0, 0)).toBeGreaterThan(decodeElevation(0, 255, 255))
    expect(decodeElevation(0, 1, 0)).toBeGreaterThan(decodeElevation(0, 0, 255))
  })
})

describe('MapboxTerrainRgbProvider', () => {
  function makeSolidTile(elevation_m: number): Promise<Uint8Array> {
    // Encode the desired elevation into RGB, paint a solid 256x256 PNG, return its bytes.
    const n = Math.round((elevation_m + 10000) / 0.1)
    const r = (n >>> 16) & 0xff
    const g = (n >>> 8) & 0xff
    const b = n & 0xff
    const buf = Buffer.alloc(256 * 256 * 3)
    for (let i = 0; i < buf.length; i += 3) {
      buf[i] = r
      buf[i + 1] = g
      buf[i + 2] = b
    }
    return sharp(buf, { raw: { width: 256, height: 256, channels: 3 } })
      .png()
      .toBuffer()
      .then(b => new Uint8Array(b))
  }

  it('throws if apiKey is missing', () => {
    expect(() => new MapboxTerrainRgbProvider({ apiKey: '' })).toThrow(ProviderError)
  })

  it('builds the expected tile URL for a known (lat, lon, zoom)', async () => {
    const calls: string[] = []
    const provider = new MapboxTerrainRgbProvider({
      apiKey: 'pk.test',
      zoom: 14,
      fetchImpl: async url => {
        calls.push(url as string)
        return new Response(await makeSolidTile(123.4), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        })
      },
    })
    // Spielberg ~47.2197, 14.7647 → tile-14 (8863, 5747)
    // Tile X = floor(((14.7647 + 180)/360) * 16384) = 8863
    // Tile Y derived from Web Mercator projection of lat 47.2197 = 5747
    const value = await provider.sample(47.2197, 14.7647)
    expect(calls.length).toBe(1)
    expect(calls[0]).toMatch(/\/v4\/mapbox\.terrain-rgb\/14\/8863\/5747\.pngraw/)
    expect(calls[0]).toContain('access_token=pk.test')
    expect(value).toBeCloseTo(123.4, 1)
  })

  it('returns ProviderError on 401 and reports non-retryable', async () => {
    const provider = new MapboxTerrainRgbProvider({
      apiKey: 'bad',
      zoom: 14,
      fetchImpl: async () =>
        new Response('Forbidden', { status: 401, statusText: 'Unauthorized' }),
    })
    let caught: unknown = null
    try {
      await provider.sample(0, 0)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ProviderError)
    expect((caught as ProviderError).retryable).toBe(false)
    expect((caught as ProviderError).status).toBe(401)
  })

  it('reuses cached tile for the same (z,x,y) across two samples', async () => {
    let fetches = 0
    const provider = new MapboxTerrainRgbProvider({
      apiKey: 'pk.test',
      zoom: 14,
      fetchImpl: async () => {
        fetches++
        return new Response(await makeSolidTile(50), { status: 200 })
      },
    })
    // Two samples within the same tile (interior pixels — both ~Spielberg).
    await provider.sample(47.2197, 14.7647)
    await provider.sample(47.2199, 14.7649)
    expect(fetches).toBe(1)
  })

  it('fetch() returns a grid sampled across the bbox via bilinear', async () => {
    const provider = new MapboxTerrainRgbProvider({
      apiKey: 'pk.test',
      zoom: 14,
      fetchImpl: async () =>
        new Response(await makeSolidTile(42), { status: 200 }),
    })
    const grid = await provider.fetch({
      south: 47.21,
      north: 47.23,
      west: 14.76,
      east: 14.78,
      targetCols: 4,
      targetRows: 4,
    })
    expect(grid.provider).toBe('mapbox-terrain-rgb')
    expect(grid.datum).toBe('MAPBOX_NATIVE')
    expect(grid.cols).toBe(4)
    expect(grid.rows).toBe(4)
    expect(grid.data.length).toBe(16)
    for (const v of grid.data) {
      expect(v).toBeCloseTo(42, 1)
    }
  })
})
