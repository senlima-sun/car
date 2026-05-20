import bakuSidecar from '../constants/tracks/sources/_terrain/baku.heightmap.json'
import catalunyaSidecar from '../constants/tracks/sources/_terrain/catalunya.heightmap.json'
import cotaSidecar from '../constants/tracks/sources/_terrain/cota.heightmap.json'
import hungaroringSidecar from '../constants/tracks/sources/_terrain/hungaroring.heightmap.json'
import imolaSidecar from '../constants/tracks/sources/_terrain/imola.heightmap.json'
import interlagosSidecar from '../constants/tracks/sources/_terrain/interlagos.heightmap.json'
import lasVegasSidecar from '../constants/tracks/sources/_terrain/las-vegas.heightmap.json'
import losailSidecar from '../constants/tracks/sources/_terrain/losail.heightmap.json'
import madridSidecar from '../constants/tracks/sources/_terrain/madrid.heightmap.json'
import melbourneSidecar from '../constants/tracks/sources/_terrain/melbourne.heightmap.json'
import mexicoCitySidecar from '../constants/tracks/sources/_terrain/mexico-city.heightmap.json'
import miamiSidecar from '../constants/tracks/sources/_terrain/miami.heightmap.json'
import monacoSidecar from '../constants/tracks/sources/_terrain/monaco.heightmap.json'
import montrealSidecar from '../constants/tracks/sources/_terrain/montreal.heightmap.json'
import monzaSidecar from '../constants/tracks/sources/_terrain/monza.heightmap.json'
import redBullRingSidecar from '../constants/tracks/sources/_terrain/red-bull-ring.heightmap.json'
import shanghaiSidecar from '../constants/tracks/sources/_terrain/shanghai.heightmap.json'
import silverstoneSidecar from '../constants/tracks/sources/_terrain/silverstone.heightmap.json'
import singaporeSidecar from '../constants/tracks/sources/_terrain/singapore.heightmap.json'
import spaSidecar from '../constants/tracks/sources/_terrain/spa.heightmap.json'
import suzukaSidecar from '../constants/tracks/sources/_terrain/suzuka.heightmap.json'
import yasMarinaSidecar from '../constants/tracks/sources/_terrain/yas-marina.heightmap.json'
import zandvoortSidecar from '../constants/tracks/sources/_terrain/zandvoort.heightmap.json'

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

const staticSidecars: Record<string, TerrainSidecar> = {
  baku: bakuSidecar as TerrainSidecar,
  catalunya: catalunyaSidecar as TerrainSidecar,
  cota: cotaSidecar as TerrainSidecar,
  hungaroring: hungaroringSidecar as TerrainSidecar,
  imola: imolaSidecar as TerrainSidecar,
  interlagos: interlagosSidecar as TerrainSidecar,
  'las-vegas': lasVegasSidecar as TerrainSidecar,
  losail: losailSidecar as TerrainSidecar,
  madrid: madridSidecar as TerrainSidecar,
  melbourne: melbourneSidecar as TerrainSidecar,
  'mexico-city': mexicoCitySidecar as TerrainSidecar,
  miami: miamiSidecar as TerrainSidecar,
  monaco: monacoSidecar as TerrainSidecar,
  montreal: montrealSidecar as TerrainSidecar,
  monza: monzaSidecar as TerrainSidecar,
  'red-bull-ring': redBullRingSidecar as TerrainSidecar,
  shanghai: shanghaiSidecar as TerrainSidecar,
  silverstone: silverstoneSidecar as TerrainSidecar,
  singapore: singaporeSidecar as TerrainSidecar,
  spa: spaSidecar as TerrainSidecar,
  suzuka: suzukaSidecar as TerrainSidecar,
  'yas-marina': yasMarinaSidecar as TerrainSidecar,
  zandvoort: zandvoortSidecar as TerrainSidecar,
}

let sidecarLoaders: Record<string, SidecarLoader> = Object.fromEntries(
  Object.entries(staticSidecars).map(([name, sidecar]) => [
    `../constants/tracks/sources/_terrain/${name}.heightmap.json`,
    () => Promise.resolve({ default: sidecar }),
  ]),
)

export function __setSidecarLoadersForTest(
  loaders: Record<string, SidecarLoader>,
): void {
  sidecarLoaders = loaders
}

const INT16_MIN = -32768
const INT16_MAX = 32767

function decodeInt16Cm(base64: string, presetId: string): number[] {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ints = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
  const out = new Array<number>(ints.length)
  let clampedCount = 0
  for (let i = 0; i < ints.length; i++) {
    const raw = ints[i]!
    if (raw === INT16_MIN || raw === INT16_MAX) clampedCount++
    out[i] = raw / 100
  }
  if (import.meta.env?.DEV && clampedCount > 0) {
    console.warn(
      `[terrain] sidecar ${presetId} has ${clampedCount} clamped cells (±327.67m saturation); producer should re-tune verticalOriginMeters`,
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
