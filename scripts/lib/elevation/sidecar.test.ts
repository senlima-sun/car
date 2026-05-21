import { describe, expect, test } from 'vitest'

import { decodeSidecar, encodeSidecar } from './sidecar'

describe('sidecar encode/decode', () => {
  test('round-trip preserves heights within 0.005m', () => {
    const resolution = 256
    const data = new Float32Array(resolution * resolution)
    for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 0.01) * 50
    const { sidecar } = encodeSidecar({
      data,
      resolution,
      worldSize: 4000,
      verticalOriginMeters: 0,
      centerLat: 50.4372,
      centerLon: 5.9714,
      halfExtentMeters: 1300,
      provider: 'opentopography-cop30',
      dem: 'GLO-30',
      datum: 'EGM2008',
    })
    const decoded = decodeSidecar(sidecar)
    let maxErr = 0
    for (let i = 0; i < data.length; i++) {
      maxErr = Math.max(maxErr, Math.abs(decoded[i]! - data[i]!))
    }
    expect(maxErr).toBeLessThanOrEqual(0.005005)
  })

  test('rejects values exceeding Int16 cm range', () => {
    const data = new Float32Array(4)
    data[0] = 500
    expect(() =>
      encodeSidecar({
        data,
        resolution: 2,
        worldSize: 4000,
        verticalOriginMeters: 0,
        centerLat: 0,
        centerLon: 0,
        halfExtentMeters: 100,
        provider: 'opentopography-cop30',
        dem: 'GLO-30',
        datum: 'EGM2008',
      })
    ).toThrow(/exceeds Int16/)
  })

  test('preserves provider metadata', () => {
    const data = new Float32Array(4)
    const { sidecar } = encodeSidecar({
      data,
      resolution: 2,
      worldSize: 4000,
      verticalOriginMeters: 100,
      centerLat: 1,
      centerLon: 2,
      halfExtentMeters: 100,
      provider: 'open-elevation',
      dem: 'SRTM',
      datum: 'EGM2008',
    })
    expect(sidecar.provider).toBe('open-elevation')
    expect(sidecar.dem).toBe('SRTM')
    expect(sidecar.verticalOriginMeters).toBe(100)
  })
})
