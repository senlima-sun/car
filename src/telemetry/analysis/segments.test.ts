import { describe, expect, test } from 'bun:test'
import { analyzeSegments } from './segments'
import { TELEMETRY_SCHEMA_VERSION, type LapTrace, type TelemetryFrame } from '../schema'

function makeLap(mods: Array<Partial<TelemetryFrame>>): LapTrace {
  const frames: TelemetryFrame[] = mods.map((m, i) => ({
    tMs: i * 100,
    speedMs: 50,
    throttle: 1,
    brake: 0,
    steer: 0,
    gear: 5,
    rpm: 9000,
    position: [0, 0, 0],
    tireWearFront: 0,
    tireWearRear: 0,
    ersCharge: 0.5,
    flag: 0,
    invalid: false,
    ...m,
  }))
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    trackId: 'unit',
    lapNumber: 1,
    lapTimeMs: frames.length * 100,
    setupId: null,
    frames,
    capturedAt: 0,
  }
}

describe('analyzeSegments', () => {
  test('finds time loss segments ordered by magnitude', () => {
    const current = makeLap(new Array(200).fill({ speedMs: 40, brake: 0.6 }))
    const reference = makeLap(new Array(200).fill({ speedMs: 55, brake: 0.2 }))
    const losses = analyzeSegments(current, reference, 10)
    expect(losses.length).toBeGreaterThan(0)
    expect(losses[0].deltaMs).toBeGreaterThanOrEqual(losses[losses.length - 1].deltaMs)
  })

  test('empty laps return no losses', () => {
    const empty: LapTrace = {
      schemaVersion: TELEMETRY_SCHEMA_VERSION,
      trackId: 'unit',
      lapNumber: 0,
      lapTimeMs: null,
      setupId: null,
      frames: [],
      capturedAt: 0,
    }
    expect(analyzeSegments(empty, empty)).toEqual([])
  })
})
