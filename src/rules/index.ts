import type { Adjudication, Violation, ViolationKind } from '@/types/rules'
import type { SessionEvent } from '@/types/sessionEvents'

export interface Rule {
  kind: ViolationKind
  adjudicate(violation: Violation, history: Violation[]): Adjudication
}

const TRACK_LIMITS_INVALIDATION_THRESHOLD = 3

const trackLimitsRule: Rule = {
  kind: 'track_limits',
  adjudicate: (violation, history) => {
    const sameLap = history.filter(
      v => v.kind === 'track_limits' && v.lapNumber === violation.lapNumber,
    )
    if (sameLap.length >= TRACK_LIMITS_INVALIDATION_THRESHOLD) {
      return {
        violationId: violation.id,
        outcome: { kind: 'lap_invalidated' },
        rationale: 'Three or more track-limits violations on the same lap.',
        at: violation.at,
      }
    }
    return {
      violationId: violation.id,
      outcome: { kind: 'warning' },
      rationale: `Track limits violation ${sameLap.length}/${TRACK_LIMITS_INVALIDATION_THRESHOLD}`,
      at: violation.at,
    }
  },
}

const pitSpeedingRule: Rule = {
  kind: 'pit_speeding',
  adjudicate: violation => ({
    violationId: violation.id,
    outcome: { kind: 'penalty', timeSeconds: 5 },
    rationale: 'Pit-lane speeding incurs a 5-second time penalty.',
    at: violation.at,
  }),
}

const jumpStartRule: Rule = {
  kind: 'jump_start',
  adjudicate: violation => ({
    violationId: violation.id,
    outcome: { kind: 'penalty', timeSeconds: 5 },
    rationale: 'Jump start at race start.',
    at: violation.at,
  }),
}

const wrongWayRule: Rule = {
  kind: 'wrong_way',
  adjudicate: violation => ({
    violationId: violation.id,
    outcome: { kind: 'lap_invalidated' },
    rationale: 'Wrong-way driving invalidates the current lap.',
    at: violation.at,
  }),
}

const rules: Record<ViolationKind, Rule> = {
  track_limits: trackLimitsRule,
  pit_speeding: pitSpeedingRule,
  jump_start: jumpStartRule,
  wrong_way: wrongWayRule,
}

export class RulesEngine {
  private history: Violation[] = []
  private adjudications: Adjudication[] = []

  reset(): void {
    this.history = []
    this.adjudications = []
  }

  observe(violation: Violation): Adjudication {
    this.history.push(violation)
    const rule = rules[violation.kind]
    const adj = rule.adjudicate(violation, this.history)
    this.adjudications.push(adj)
    return adj
  }

  observeSessionEvent(event: SessionEvent, currentLap: number | null): Adjudication | null {
    switch (event.type) {
      case 'track_limits_violation':
        return this.observe({
          id: event.id,
          kind: 'track_limits',
          at: event.at,
          lapNumber: currentLap,
          severity: 'warning',
        })
      case 'jump_start':
        return this.observe({
          id: event.id,
          kind: 'jump_start',
          at: event.at,
          lapNumber: currentLap,
          severity: 'major',
        })
      default:
        return null
    }
  }

  getAdjudications(): ReadonlyArray<Adjudication> {
    return this.adjudications
  }

  getViolations(): ReadonlyArray<Violation> {
    return this.history
  }
}
