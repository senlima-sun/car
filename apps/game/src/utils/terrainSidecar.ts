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

function presetIdToCircuitName(presetId: string): string {
  return presetId.replace(/^f1_/, '')
}

function loaderKeyForCircuit(name: string): string {
  return `../constants/tracks/sources/_terrain/${name}.heightmap.json`
}

function decodeInt16Cm(base64: string): Float32Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ints = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
  const out = new Float32Array(ints.length)
  for (let i = 0; i < ints.length; i++) out[i] = ints[i]! / 100
  return out
}

export function presetHasTerrainSidecar(presetId: string): boolean {
  const name = presetIdToCircuitName(presetId)
  return Boolean(sidecarLoaders[loaderKeyForCircuit(name)])
}

export async function getTerrainHeightmapForPreset(
  presetId: string
): Promise<TerrainSidecarResult | null> {
  const name = presetIdToCircuitName(presetId)
  const loader = sidecarLoaders[loaderKeyForCircuit(name)]
  if (!loader) return null
  const mod = await loader()
  const sidecar = mod.default
  if (sidecar.encoding !== 'int16-cm') {
    throw new Error(`unsupported terrain sidecar encoding: ${sidecar.encoding}`)
  }
  const decoded = decodeInt16Cm(sidecar.data)
  return {
    heightmap: Array.from(decoded),
    verticalOriginMeters: sidecar.verticalOriginMeters,
    provider: sidecar.provider,
    dem: sidecar.dem,
  }
}
