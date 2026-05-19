import type { DatumName, DemName, ProviderName } from './provider'

export type SidecarEncoding = 'int16-cm'

export interface TerrainSidecar {
  version: 1
  resolution: number
  worldSize: number
  encoding: SidecarEncoding
  verticalOriginMeters: number
  centerLat: number
  centerLon: number
  halfExtentMeters: number
  provider: ProviderName
  dem: DemName
  datum: DatumName
  data: string
}

const INT16_MIN = -32768
const INT16_MAX = 32767
const SCALE = 100

export function encodeSidecar(args: {
  data: Float32Array
  resolution: number
  worldSize: number
  verticalOriginMeters: number
  centerLat: number
  centerLon: number
  halfExtentMeters: number
  provider: ProviderName
  dem: DemName
  datum: DatumName
}): TerrainSidecar {
  if (args.data.length !== args.resolution * args.resolution) {
    throw new Error(
      `sidecar data length ${args.data.length} != resolution²=${args.resolution * args.resolution}`
    )
  }
  const ints = new Int16Array(args.data.length)
  for (let i = 0; i < args.data.length; i++) {
    const cm = Math.round(args.data[i]! * SCALE)
    if (cm < INT16_MIN || cm > INT16_MAX) {
      throw new Error(
        `cell ${i} height ${args.data[i]}m exceeds Int16 cm range; raise verticalOriginMeters or split sidecar`
      )
    }
    ints[i] = cm
  }
  const bytes = Buffer.from(ints.buffer, ints.byteOffset, ints.byteLength)
  return {
    version: 1,
    resolution: args.resolution,
    worldSize: args.worldSize,
    encoding: 'int16-cm',
    verticalOriginMeters: args.verticalOriginMeters,
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    halfExtentMeters: args.halfExtentMeters,
    provider: args.provider,
    dem: args.dem,
    datum: args.datum,
    data: bytes.toString('base64'),
  }
}

export function decodeSidecar(sidecar: TerrainSidecar): Float32Array {
  if (sidecar.encoding !== 'int16-cm') {
    throw new Error(`unsupported sidecar encoding: ${sidecar.encoding}`)
  }
  const buf = Buffer.from(sidecar.data, 'base64')
  const ints = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
  const out = new Float32Array(ints.length)
  for (let i = 0; i < ints.length; i++) out[i] = ints[i]! / SCALE
  return out
}
