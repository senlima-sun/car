import { TIRE_COMPOUND } from './colors'

export type TireCompound = 'soft' | 'medium' | 'hard' | 'wet' | 'intermediate'

export interface TireDisplayConfig {
  displayName: string
  color: string
  icon: string
}

export const TIRE_CONFIG: Record<TireCompound, TireDisplayConfig> = {
  soft: {
    displayName: 'Soft',
    color: TIRE_COMPOUND.soft,
    icon: 'S',
  },
  medium: {
    displayName: 'Medium',
    color: TIRE_COMPOUND.medium,
    icon: 'M',
  },
  hard: {
    displayName: 'Hard',
    color: TIRE_COMPOUND.hard,
    icon: 'H',
  },
  wet: {
    displayName: 'Wet',
    color: TIRE_COMPOUND.wet,
    icon: 'W',
  },
  intermediate: {
    displayName: 'Inter',
    color: TIRE_COMPOUND.intermediate,
    icon: 'I',
  },
}

export const DEFAULT_TIRE: TireCompound = 'medium'

export const TIRE_WEAR_WARNING = 70
export const TIRE_WEAR_CRITICAL = 90

export const TIRE_ORDER: TireCompound[] = ['soft', 'medium', 'hard', 'intermediate', 'wet']
