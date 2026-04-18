export type ViolationKind =
  | 'track_limits'
  | 'pit_speeding'
  | 'jump_start'
  | 'wrong_way'

export interface Violation {
  id: string
  kind: ViolationKind
  at: number
  lapNumber: number | null
  severity: 'warning' | 'minor' | 'major'
  detail?: string
}

export type AdjudicationOutcome =
  | { kind: 'warning'; lapInvalidated?: boolean }
  | { kind: 'penalty'; timeSeconds: number; lapInvalidated?: boolean }
  | { kind: 'lap_invalidated' }
  | { kind: 'none' }

export interface Adjudication {
  violationId: string
  outcome: AdjudicationOutcome
  rationale: string
  at: number
}
