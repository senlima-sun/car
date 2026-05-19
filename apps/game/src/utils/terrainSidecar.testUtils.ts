import type { TerrainSidecar } from './terrainSidecar'

export function encodeMockSidecar(args: {
  data: Float32Array
  verticalOriginMeters: number
}): TerrainSidecar {
  const ints = new Int16Array(args.data.length)
  for (let i = 0; i < args.data.length; i++) {
    ints[i] = Math.max(-32768, Math.min(32767, Math.round(args.data[i]! * 100)))
  }
  const bytes = new Uint8Array(ints.buffer, ints.byteOffset, ints.byteLength)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return {
    version: 1,
    resolution: 256,
    worldSize: 4000,
    encoding: 'int16-cm',
    verticalOriginMeters: args.verticalOriginMeters,
    centerLat: 0,
    centerLon: 0,
    halfExtentMeters: 1300,
    provider: 'mock',
    dem: 'mock',
    datum: 'EGM2008',
    data: typeof Buffer !== 'undefined' ? Buffer.from(bytes).toString('base64') : btoa(binary),
  }
}
