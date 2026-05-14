import { describe, expect, test } from 'bun:test'
import { deriveSessionEvents, sectorSplitKey, type SessionSnapshot } from './sessionEvents'

const NOW = 1_000_000_000

const baseSnapshot: SessionSnapshot = {
  phase: 'idle',
  lapCount: 0,
  lastLapTime: null,
  bestLapTime: null,
  currentLapStart: null,
  currentLapInvalid: false,
  lastSectorSplitKey: null,
  isInPitLane: false,
  isPitStopActive: false,
  pitLaneSpeedingPenalty: 0,
  violationCount: 0,
  totalViolationTime: 0,
}

describe('deriveSessionEvents — phase transitions', () => {
  test('emits session_started when phase becomes running', () => {
    const events = deriveSessionEvents(baseSnapshot, { ...baseSnapshot, phase: 'running' }, NOW, null)
    expect(events).toEqual([{ type: 'session_started', at: NOW }])
  })

  test('emits session_paused when running → paused', () => {
    const events = deriveSessionEvents(
      { ...baseSnapshot, phase: 'running' },
      { ...baseSnapshot, phase: 'paused' },
      NOW,
      null,
    )
    expect(events).toEqual([{ type: 'session_paused', at: NOW }])
  })

  test('emits session_started (not resumed) when paused → running, matching legacy behavior', () => {
    // The original SessionEventBridge had an if/else chain where
    // `isRunning(next) && !isRunning(prev)` matched first, so paused→running
    // emitted session_started. Preserved here for byte-identical behavior.
    const events = deriveSessionEvents(
      { ...baseSnapshot, phase: 'paused' },
      { ...baseSnapshot, phase: 'running' },
      NOW,
      null,
    )
    expect(events).toEqual([{ type: 'session_started', at: NOW }])
  })

  test('emits no events when phase unchanged', () => {
    expect(deriveSessionEvents(baseSnapshot, baseSnapshot, NOW, null)).toEqual([])
  })
})

describe('deriveSessionEvents — phase gating', () => {
  test('lap_started suppressed when phase not running', () => {
    const prev = { ...baseSnapshot, phase: 'paused' as const }
    const next = { ...baseSnapshot, phase: 'paused' as const, currentLapStart: 5 }
    expect(deriveSessionEvents(prev, next, NOW, null)).toEqual([])
  })

  test('lap_completed suppressed when phase not running', () => {
    const prev = { ...baseSnapshot, phase: 'paused' as const }
    const next = { ...baseSnapshot, phase: 'paused' as const, lapCount: 1, lastLapTime: 60_000 }
    expect(deriveSessionEvents(prev, next, NOW, null)).toEqual([])
  })
})

describe('deriveSessionEvents — running-phase events', () => {
  const running = { ...baseSnapshot, phase: 'running' as const }

  test('lap_started fires when currentLapStart goes null → number', () => {
    const events = deriveSessionEvents(running, { ...running, currentLapStart: 1 }, NOW, null)
    expect(events).toEqual([{ type: 'lap_started', at: NOW, lapNumber: 1 }])
  })

  test('lap_completed (valid, not personal best)', () => {
    const events = deriveSessionEvents(
      running,
      { ...running, lapCount: 1, lastLapTime: 65_000, bestLapTime: 60_000 },
      NOW,
      null,
    )
    expect(events).toEqual([
      {
        type: 'lap_completed',
        at: NOW,
        lapNumber: 1,
        lapTime: 65_000,
        valid: true,
        isPersonalBest: false,
      },
    ])
  })

  test('lap_completed marks isPersonalBest when lastLapTime === bestLapTime', () => {
    const events = deriveSessionEvents(
      running,
      { ...running, lapCount: 1, lastLapTime: 60_000, bestLapTime: 60_000 },
      NOW,
      null,
    )
    expect(events[0]).toMatchObject({ type: 'lap_completed', isPersonalBest: true })
  })

  test('lap_invalidated fires on currentLapInvalid edge', () => {
    const events = deriveSessionEvents(running, { ...running, currentLapInvalid: true }, NOW, null)
    expect(events).toEqual([{ type: 'lap_invalidated', at: NOW, reason: 'wrong-way' }])
  })

  test('sector_completed fires when split key changes', () => {
    const events = deriveSessionEvents(
      { ...running, lastSectorSplitKey: '0::' },
      { ...running, lastSectorSplitKey: '1:30000:0' },
      NOW,
      { sectorNumber: 1, time: 30_000, delta: 0 },
    )
    expect(events).toEqual([
      { type: 'sector_completed', at: NOW, sectorNumber: 1, sectorTime: 30_000, delta: 0 },
    ])
  })

  test('sector_completed suppressed when split key unchanged', () => {
    const events = deriveSessionEvents(
      { ...running, lastSectorSplitKey: '1:30000:0' },
      { ...running, lastSectorSplitKey: '1:30000:0' },
      NOW,
      { sectorNumber: 1, time: 30_000, delta: 0 },
    )
    expect(events).toEqual([])
  })

  test('pit_lane_entered and pit_lane_exited', () => {
    const enter = deriveSessionEvents(running, { ...running, isInPitLane: true }, NOW, null)
    expect(enter).toEqual([{ type: 'pit_lane_entered', at: NOW }])
    const exit = deriveSessionEvents(
      { ...running, isInPitLane: true },
      { ...running, isInPitLane: false },
      NOW,
      null,
    )
    expect(exit).toEqual([{ type: 'pit_lane_exited', at: NOW }])
  })

  test('pit_stop_started and pit_stop_ended', () => {
    const start = deriveSessionEvents(running, { ...running, isPitStopActive: true }, NOW, null)
    expect(start).toEqual([{ type: 'pit_stop_started', at: NOW }])
    const end = deriveSessionEvents(
      { ...running, isPitStopActive: true },
      { ...running, isPitStopActive: false },
      NOW,
      null,
    )
    expect(end).toEqual([{ type: 'pit_stop_ended', at: NOW }])
  })

  test('pit_penalty_applied with delta and total', () => {
    const events = deriveSessionEvents(
      { ...running, pitLaneSpeedingPenalty: 1 },
      { ...running, pitLaneSpeedingPenalty: 4 },
      NOW,
      null,
    )
    expect(events).toEqual([
      { type: 'pit_penalty_applied', at: NOW, penaltySeconds: 3, totalPenaltySeconds: 4 },
    ])
  })

  test('track_limits_violation includes count and total time', () => {
    const events = deriveSessionEvents(
      { ...running, violationCount: 1, totalViolationTime: 200 },
      { ...running, violationCount: 2, totalViolationTime: 350 },
      NOW,
      null,
    )
    expect(events).toEqual([
      { type: 'track_limits_violation', at: NOW, violationCount: 2, totalViolationTime: 350 },
    ])
  })
})

describe('sectorSplitKey', () => {
  test('null for null split', () => {
    expect(sectorSplitKey(null)).toBeNull()
  })

  test('encodes sectorNumber, time, delta', () => {
    expect(sectorSplitKey({ sectorNumber: 2, time: 33_500, delta: -150 })).toBe('2:33500:-150')
  })

  test('null delta becomes empty string', () => {
    expect(sectorSplitKey({ sectorNumber: 1, time: 30_000, delta: null })).toBe('1:30000:')
  })
})
