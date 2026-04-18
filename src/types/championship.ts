export interface ChampionshipRound {
  trackId: string
  lapLimit: number
  completed: boolean
  resultPosition: number | null
}

export interface ChampionshipStanding {
  driverName: string
  teamId: string
  points: number
  wins: number
  podiums: number
}

export interface ChampionshipState {
  id: string
  season: number
  name: string
  calendar: ChampionshipRound[]
  currentRoundIndex: number
  driverStandings: ChampionshipStanding[]
  teamStandings: ChampionshipStanding[]
}

export const F1_POINTS_TABLE: number[] = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

export function pointsForPosition(pos: number): number {
  if (pos < 1 || pos > F1_POINTS_TABLE.length) return 0
  return F1_POINTS_TABLE[pos - 1]
}
