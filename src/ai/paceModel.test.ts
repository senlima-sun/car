import { describe, expect, test } from 'bun:test'
import { samplePace, type AiDriverProfile } from './paceModel'
import type { RacingLine } from '@/types/racingLine'

const line: RacingLine = {
  trackId: 'unit',
  totalLengthM: 4000,
  waypoints: [
    { s: 0.0, position: [0, 0, 0], targetSpeedMs: 80 },
    { s: 0.25, position: [0, 0, 100], targetSpeedMs: 60 },
    { s: 0.5, position: [0, 0, 200], targetSpeedMs: 40 },
    { s: 0.75, position: [0, 0, 300], targetSpeedMs: 70 },
  ],
}

function profile(over: Partial<AiDriverProfile> = {}): AiDriverProfile {
  return {
    id: 'p',
    teamId: 't',
    driverName: 'Test',
    skill: 0.8,
    aggression: 0.5,
    consistency: 1,
    tireManagement: 0.5,
    ...over,
  }
}

describe('samplePace', () => {
  test('brakes when currently faster than target', () => {
    const sample = samplePace(profile(), line, 0.5, 120)
    expect(sample.brake).toBeGreaterThan(0)
    expect(sample.throttle).toBe(0)
  })

  test('accelerates when below target', () => {
    const sample = samplePace(profile(), line, 0.0, 20)
    expect(sample.throttle).toBeGreaterThan(0)
    expect(sample.brake).toBe(0)
  })

  test('skill affects target speed', () => {
    const low = samplePace(profile({ skill: 0.2 }), line, 0.5, 40).targetSpeedMs
    const high = samplePace(profile({ skill: 1.0 }), line, 0.5, 40).targetSpeedMs
    expect(high).toBeGreaterThan(low)
  })
})
