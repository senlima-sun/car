import { describe, expect, test, beforeEach } from 'vitest'
import { RulesEngine } from './index'

describe('RulesEngine', () => {
  let engine: RulesEngine

  beforeEach(() => {
    engine = new RulesEngine()
  })

  test('third track_limits violation invalidates the lap', () => {
    const base = {
      kind: 'track_limits' as const,
      at: 0,
      lapNumber: 1,
      severity: 'warning' as const,
    }
    engine.observe({ ...base, id: 'a' })
    engine.observe({ ...base, id: 'b' })
    const third = engine.observe({ ...base, id: 'c' })
    expect(third.outcome.kind).toBe('lap_invalidated')
  })

  test('first track_limits violation warns', () => {
    const adj = engine.observe({
      id: 'x',
      kind: 'track_limits',
      at: 0,
      lapNumber: 1,
      severity: 'warning',
    })
    expect(adj.outcome.kind).toBe('warning')
  })

  test('pit_speeding yields a 5-second penalty', () => {
    const adj = engine.observe({
      id: 'p',
      kind: 'pit_speeding',
      at: 0,
      lapNumber: 1,
      severity: 'major',
    })
    expect(adj.outcome.kind).toBe('penalty')
    if (adj.outcome.kind === 'penalty') {
      expect(adj.outcome.timeSeconds).toBe(5)
    }
  })

  test('reset clears history', () => {
    engine.observe({ id: '1', kind: 'track_limits', at: 0, lapNumber: 1, severity: 'warning' })
    engine.reset()
    expect(engine.getAdjudications().length).toBe(0)
    expect(engine.getViolations().length).toBe(0)
  })

  test('observeSessionEvent ignores unrelated events', () => {
    const result = engine.observeSessionEvent({ id: 'sess', type: 'session_started', at: 0 }, null)
    expect(result).toBeNull()
  })
})
