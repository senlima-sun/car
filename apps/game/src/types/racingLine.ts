export interface RacingLineWaypoint {
  /** 0..1 normalized distance along the lap. */
  s: number
  /** World-space position of the line at this waypoint. */
  position: [number, number, number]
  /** Target speed in m/s at this waypoint. */
  targetSpeedMs: number
  /** Braking marker flag (apex of a braking zone). */
  brakingPoint?: boolean
  /** Turn-in marker flag. */
  turnIn?: boolean
  /** Apex marker flag. */
  apex?: boolean
  /** Exit marker flag. */
  exit?: boolean
  /** Optional alternate line offset in meters perpendicular to the base line. */
  alternateOffsetM?: number
}

export interface RacingLine {
  trackId: string
  totalLengthM: number
  waypoints: RacingLineWaypoint[]
}

/** Find the waypoint at the given normalized s (wraps). */
export function sampleRacingLine(line: RacingLine, s: number): RacingLineWaypoint {
  if (line.waypoints.length === 0) {
    return {
      s,
      position: [0, 0, 0],
      targetSpeedMs: 40,
    }
  }
  const wrapped = ((s % 1) + 1) % 1
  let lo = 0
  let hi = line.waypoints.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (line.waypoints[mid].s < wrapped) lo = mid + 1
    else hi = mid
  }
  return line.waypoints[lo]
}
