export type CarParticipantKind = 'player' | 'ai'

export interface GridCarState {
  id: string
  kind: CarParticipantKind
  teamId: string
  driverName: string
  position: [number, number, number]
  rotation: [number, number, number, number]
  speedMs: number
  currentLap: number
  currentSector: number
  distanceAlongLap: number
  tireCompound: 'soft' | 'medium' | 'hard' | 'intermediate' | 'wet' | null
  tireWearFront: number
  tireWearRear: number
  inPitLane: boolean
  racePosition: number
  gapToLeaderMs: number | null
  intervalToAheadMs: number | null
  dnf: boolean
}

export interface GridStateSnapshot {
  version: number
  cars: GridCarState[]
  /** Ordered list of car ids by race position. */
  classification: string[]
  leaderLap: number
}
