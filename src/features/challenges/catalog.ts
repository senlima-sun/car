import { TireCompound } from '@/wasm/PhysicsBridge'

export type ChallengeMedal = 'gold' | 'silver' | 'bronze'

export interface ChallengeDefinition {
  id: string
  title: string
  description: string
  trackId: string
  /** Weather preset applied at session start. */
  weather: 'dry' | 'wet' | 'changeable'
  tireCompound: TireCompound | null
  lapLimit: number
  /** Gold/silver/bronze target lap times in ms. */
  medals: Record<ChallengeMedal, number>
  /** Rotating tag – daily, weekly, campaign. */
  rotation: 'daily' | 'weekly' | 'campaign'
  rotationDay?: string
}

export const BUILTIN_CHALLENGES: ChallengeDefinition[] = [
  {
    id: 'silverstone-dry-hotlap',
    title: 'Silverstone Dry Hotlap',
    description: 'Set the fastest lap in dry conditions on medium compound.',
    trackId: 'silverstone',
    weather: 'dry',
    tireCompound: TireCompound.Medium,
    lapLimit: 3,
    medals: { gold: 90000, silver: 92000, bronze: 94000 },
    rotation: 'campaign',
  },
  {
    id: 'monza-drs-test',
    title: 'Monza DRS Test',
    description: 'Learn to exploit the new DRS zones without spinning the rears.',
    trackId: 'monza',
    weather: 'dry',
    tireCompound: TireCompound.Soft,
    lapLimit: 3,
    medals: { gold: 83500, silver: 84500, bronze: 86000 },
    rotation: 'weekly',
  },
  {
    id: 'suzuka-wet-survival',
    title: 'Suzuka Wet Survival',
    description: 'Five laps in rising rain; limit invalid laps to zero.',
    trackId: 'suzuka',
    weather: 'wet',
    tireCompound: TireCompound.Intermediate,
    lapLimit: 5,
    medals: { gold: 115000, silver: 118000, bronze: 122000 },
    rotation: 'daily',
  },
]

export function classifyLapTime(
  challenge: ChallengeDefinition,
  lapTimeMs: number,
): ChallengeMedal | null {
  if (lapTimeMs <= challenge.medals.gold) return 'gold'
  if (lapTimeMs <= challenge.medals.silver) return 'silver'
  if (lapTimeMs <= challenge.medals.bronze) return 'bronze'
  return null
}
