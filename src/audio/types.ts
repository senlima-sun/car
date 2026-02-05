export type SoundCategory = 'engine' | 'effects' | 'ui' | 'music'

export interface SoundConfig {
  src?: string | string[]
  category: SoundCategory
  loop?: boolean
  volume?: number
  rate?: number
  sprite?: Record<string, [number, number]>
}

export interface FrameAudioParams {
  rpm: number
  speed: number
  gear: number
  slipAngle: number
  isDrifting: boolean
  skidIntensity: number
  isAquaplaning: boolean
  aquaplaningIntensity: number
  surface: 'road' | 'grass' | 'curb'
  rainIntensity: number
  windSpeed: number
  isDeploying: boolean
  isHarvesting: boolean
  powerFlow: number
  harvestSource: string
  engineBraking: 'Low' | 'Medium' | 'High'
}

export interface VolumeConfig {
  master: number
  engine: number
  effects: number
  ui: number
  music: number
}
