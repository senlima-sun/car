export type SessionEvent =
  | {
      id: string
      type: 'session_started' | 'session_paused' | 'session_resumed' | 'session_finished'
      at: number
    }
  | {
      id: string
      type: 'lap_started'
      at: number
      lapNumber: number
    }
  | {
      id: string
      type: 'lap_completed'
      at: number
      lapNumber: number
      lapTime: number | null
      valid: boolean
      isPersonalBest: boolean
    }
  | {
      id: string
      type: 'sector_completed'
      at: number
      sectorNumber: number
      sectorTime: number
      delta: number | null
    }
  | {
      id: string
      type: 'lap_invalidated'
      at: number
      reason: 'wrong-way' | 'off-track'
    }
  | {
      id: string
      type: 'pit_lane_entered' | 'pit_lane_exited' | 'pit_stop_started' | 'pit_stop_ended'
      at: number
    }
  | {
      id: string
      type: 'pit_penalty_applied'
      at: number
      penaltySeconds: number
      totalPenaltySeconds: number
    }
  | {
      id: string
      type: 'track_limits_violation'
      at: number
      violationCount: number
      totalViolationTime: number
    }
  | {
      id: string
      type: 'jump_start'
      at: number
    }

export type SessionEventInput = SessionEvent extends infer Event
  ? Event extends { id: string }
    ? Omit<Event, 'id'>
    : never
  : never
