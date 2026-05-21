import { describe, expect, it } from 'bun:test'

import { sampleAnchorElevations } from './anchorSampler'

describe('sampleAnchorElevations', () => {
  it('writes anchor.elevation = mapbox(anchor) - mapbox(center)', async () => {
    // Fake provider: returns lat in metres for predictable assertion.
    const provider = {
      sample: async (lat: number, _lon: number) => lat * 1000,
    }
    const config = { centerLat: 47.0, centerLon: 14.0 }
    const paths = [
      {
        anchors: [
          { point: { x: 0, y: 0 } }, // → centerLat, so should be 0 after subtraction
          { point: { x: 0, y: -110540 } }, // → 1° north of center → lat 48
          { point: { x: 0, y: 110540 } }, // → 1° south of center → lat 46
        ],
      },
    ]
    const result = await sampleAnchorElevations({ paths, config, provider })
    expect(result.anchorCount).toBe(3)
    // centerpoint sample = 47 * 1000 = 47000
    expect(result.centerpointElevation).toBe(47000)
    expect(paths[0]!.anchors[0]!.elevation).toBeCloseTo(0, 5)
    expect(paths[0]!.anchors[1]!.elevation).toBeCloseTo(48000 - 47000, 0)
    expect(paths[0]!.anchors[2]!.elevation).toBeCloseTo(46000 - 47000, 0)
    expect(paths[0]!.elevationSource).toBe('mapbox-terrain-rgb')
  })

  it('handles multi-path tracks', async () => {
    const provider = { sample: async () => 100 }
    const paths = [
      { anchors: [{ point: { x: 0, y: 0 } }] },
      { anchors: [{ point: { x: 10, y: 10 } }, { point: { x: 20, y: 20 } }] },
    ]
    const result = await sampleAnchorElevations({
      paths,
      config: { centerLat: 0, centerLon: 0 },
      provider,
    })
    expect(result.anchorCount).toBe(3)
    expect(paths[0]!.elevationSource).toBe('mapbox-terrain-rgb')
    expect(paths[1]!.elevationSource).toBe('mapbox-terrain-rgb')
    for (const p of paths)
      for (const a of p.anchors) expect(a.elevation).toBeCloseTo(0, 5)
  })

  it('is idempotent (re-runs produce identical results given same provider)', async () => {
    const provider = {
      sample: async (lat: number, lon: number) => lat * 100 + lon * 10,
    }
    const config = { centerLat: 47.2, centerLon: 14.8 }
    const paths = [
      {
        anchors: [
          { point: { x: 100, y: -200 } },
          { point: { x: 300, y: 500 } },
        ],
      },
    ]
    await sampleAnchorElevations({ paths, config, provider })
    const firstRun = paths[0]!.anchors.map(a => a.elevation)
    // Reset elevation; re-run.
    for (const a of paths[0]!.anchors) delete a.elevation
    await sampleAnchorElevations({ paths, config, provider })
    const secondRun = paths[0]!.anchors.map(a => a.elevation)
    for (let i = 0; i < firstRun.length; i++)
      expect(secondRun[i]!).toBeCloseTo(firstRun[i]!, 8)
  })
})
