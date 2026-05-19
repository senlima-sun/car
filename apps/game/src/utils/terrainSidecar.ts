export interface TerrainSidecar {
  version: number
  resolution: number
  worldSize: number
  encoding: 'int16-cm'
  verticalOriginMeters: number
  centerLat: number
  centerLon: number
  halfExtentMeters: number
  provider: string
  dem: string
  datum: string
  data: string
}

export interface TerrainSidecarResult {
  heightmap: number[]
  verticalOriginMeters: number
  provider: string
  dem: string
}

type SidecarLoader = () => Promise<{ default: TerrainSidecar }>

const viteGlob =
  typeof import.meta.glob === 'function'
    ? import.meta.glob<{ default: TerrainSidecar }>(
        '../constants/tracks/sources/_terrain/*.heightmap.json',
      )
    : {}

let sidecarLoaders: Record<string, SidecarLoader> = viteGlob as Record<string, SidecarLoader>

export function __setSidecarLoadersForTest(
  loaders: Record<string, SidecarLoader>,
): void {
  sidecarLoaders = loaders
}

function decodeInt16Cm(base64: string): number[] {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ints = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
  const out = new Array<number>(ints.length)
  for (let i = 0; i < ints.length; i++) out[i] = ints[i]! / 100
  return out
}

export async function getTerrainHeightmapForPreset(
  presetId: string,
): Promise<TerrainSidecarResult | null> {
  const circuitName = presetId.replace(/^f1_/, '')
  const loader = sidecarLoaders[`../constants/tracks/sources/_terrain/${circuitName}.heightmap.json`]
  if (!loader) return null
  const { default: sidecar } = await loader()
  if (sidecar.encoding !== 'int16-cm') {
    throw new Error(`unsupported terrain sidecar encoding: ${sidecar.encoding}`)
  }
  return {
    heightmap: decodeInt16Cm(sidecar.data),
    verticalOriginMeters: sidecar.verticalOriginMeters,
    provider: sidecar.provider,
    dem: sidecar.dem,
  }
}
