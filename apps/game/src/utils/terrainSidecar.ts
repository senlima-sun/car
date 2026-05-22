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

const defaultSidecarLoaders: Record<string, SidecarLoader> = {}

let sidecarLoaders: Record<string, SidecarLoader> = defaultSidecarLoaders

export function __setSidecarLoadersForTest(
  loaders: Record<string, SidecarLoader>,
): void {
  sidecarLoaders = loaders
}

export function __resetSidecarLoadersForTest(): void {
  sidecarLoaders = defaultSidecarLoaders
}

const SAFE_MAX_M = 80
const SAFE_MIN_M = -40

function decodeInt16Cm(base64: string, presetId: string): number[] {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ints = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
  const out = new Array<number>(ints.length)
  let clipped = 0
  for (let i = 0; i < ints.length; i++) {
    let v = ints[i]! / 100
    if (v > SAFE_MAX_M) {
      v = SAFE_MAX_M
      clipped++
    } else if (v < SAFE_MIN_M) {
      v = SAFE_MIN_M
      clipped++
    }
    out[i] = v
  }
  if (import.meta.env?.DEV && clipped > 0) {
    console.warn(
      `[terrain] sidecar ${presetId}: clipped ${clipped} cells to [${SAFE_MIN_M}, ${SAFE_MAX_M}]m for stable physics`,
    )
  }
  return out
}

export async function getTerrainHeightmapForPreset(
  presetId: string,
): Promise<TerrainSidecarResult | null> {
  const circuitName = presetId.replace(/^f1_/, '')
  const wantKey = `../constants/tracks/sources/_terrain/${circuitName}.heightmap.json`
  const loader = sidecarLoaders[wantKey]
  if (!loader) return null
  const { default: sidecar } = await loader()
  if (sidecar.encoding !== 'int16-cm') {
    throw new Error(`unsupported terrain sidecar encoding: ${sidecar.encoding}`)
  }
  return {
    heightmap: decodeInt16Cm(sidecar.data, presetId),
    verticalOriginMeters: sidecar.verticalOriginMeters,
    provider: sidecar.provider,
    dem: sidecar.dem,
  }
}
