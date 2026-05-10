import type * as THREE from 'three'

export type SkyState =
  | 'clear'
  | 'cloudy'
  | 'overcast'
  | 'drizzle'
  | 'heavyRain'
  | 'storm'
  | 'goldenHour'
  | 'overcastDusk'

export interface SkyStateAnchor {
  temperature: number
  rainIntensity: number
  isDusk: 0 | 1
}

export interface SkyStateConfig {
  id: SkyState
  file: string
  anchor: SkyStateAnchor
  exposure: number
  rotationSpeed: number
}

export const HDRI_PATH = '/textures/hdri/'

export const SKY_STATES: Record<SkyState, SkyStateConfig> = {
  clear: {
    id: 'clear',
    file: 'ClearMidday_2K_HDR.exr',
    anchor: { temperature: 25, rainIntensity: 0, isDusk: 0 },
    exposure: 1.0,
    rotationSpeed: 0.005,
  },
  cloudy: {
    id: 'cloudy',
    file: 'ScatteredClouds_2K_HDR.exr',
    anchor: { temperature: 20, rainIntensity: 0.05, isDusk: 0 },
    exposure: 0.95,
    rotationSpeed: 0.005,
  },
  overcast: {
    id: 'overcast',
    file: 'Overcast_2K_HDR.exr',
    anchor: { temperature: 18, rainIntensity: 0.1, isDusk: 0 },
    exposure: 0.85,
    rotationSpeed: 0.004,
  },
  drizzle: {
    id: 'drizzle',
    file: 'LightDrizzle_2K_HDR.exr',
    anchor: { temperature: 15, rainIntensity: 0.3, isDusk: 0 },
    exposure: 0.8,
    rotationSpeed: 0.004,
  },
  heavyRain: {
    id: 'heavyRain',
    file: 'HeavyRain_2K_HDR.exr',
    anchor: { temperature: 12, rainIntensity: 0.8, isDusk: 0 },
    exposure: 0.7,
    rotationSpeed: 0.003,
  },
  storm: {
    id: 'storm',
    file: 'StormFront_2K_HDR.exr',
    anchor: { temperature: 10, rainIntensity: 1.0, isDusk: 0 },
    exposure: 0.7,
    rotationSpeed: 0.003,
  },
  goldenHour: {
    id: 'goldenHour',
    file: 'GoldenHourClear_2K_HDR.exr',
    anchor: { temperature: 22, rainIntensity: 0, isDusk: 1 },
    exposure: 1.05,
    rotationSpeed: 0.005,
  },
  overcastDusk: {
    id: 'overcastDusk',
    file: 'OvercastDusk_2K_HDR.exr',
    anchor: { temperature: 15, rainIntensity: 0.05, isDusk: 1 },
    exposure: 0.85,
    rotationSpeed: 0.004,
  },
}

export const SKY_STATE_IDS = Object.keys(SKY_STATES) as SkyState[]

export const TEMP_SCALE = 1
export const RAIN_SCALE = 20
export const DUSK_SCALE = 30

export interface WeightedSkyState {
  id: SkyState
  weight: number
  texture: THREE.Texture | null
}

export interface BlendInputs {
  temperature: number
  rainIntensity: number
  isDusk: boolean
}

function squaredDistance(anchor: SkyStateAnchor, input: BlendInputs): number {
  const dt = (anchor.temperature - input.temperature) * TEMP_SCALE
  const dr = (anchor.rainIntensity - input.rainIntensity) * RAIN_SCALE
  const dd = (anchor.isDusk - (input.isDusk ? 1 : 0)) * DUSK_SCALE
  return dt * dt + dr * dr + dd * dd
}

const cache = new Map<string, SkyState[]>()
const CACHE_LIMIT = 64

function quantize(input: BlendInputs): string {
  const t = Math.round(input.temperature)
  const r = Math.round(input.rainIntensity * 20) / 20
  const d = input.isDusk ? 1 : 0
  return `${t}|${r}|${d}`
}

export function pickTopStates(input: BlendInputs, k = 4): SkyState[] {
  const key = `${k}|${quantize(input)}`
  const cached = cache.get(key)
  if (cached) return cached

  const ranked = SKY_STATE_IDS.map(id => ({
    id,
    score: squaredDistance(SKY_STATES[id].anchor, input),
  }))
    .sort((a, b) => a.score - b.score)
    .slice(0, k)
    .map(entry => entry.id)

  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, ranked)
  return ranked
}

export function computeWeights(input: BlendInputs, ids: SkyState[]): number[] {
  const epsilon = 0.0001
  const inverses = ids.map(id => {
    const sq = squaredDistance(SKY_STATES[id].anchor, input)
    return 1 / (sq + epsilon)
  })
  const sum = inverses.reduce((a, b) => a + b, 0)
  if (sum <= 0) return ids.map(() => 1 / ids.length)
  return inverses.map(v => v / sum)
}

export function clearSkyStateCache(): void {
  cache.clear()
}
