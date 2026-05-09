import { describe, expect, test } from 'bun:test'
import {
  accumulateWheelAngle,
  applyDecay,
  applyGammaCurve,
  applyVariableRatio,
  DEFAULT_MOUSE_STEERING_CONFIG,
  wheelAngleToSteer,
} from './steeringMath'

describe('applyGammaCurve', () => {
  test('returns 0 at 0', () => {
    expect(applyGammaCurve(0, 1.7)).toBe(0)
  })

  test('returns ±1 at ±1', () => {
    expect(applyGammaCurve(1, 1.7)).toBeCloseTo(1, 9)
    expect(applyGammaCurve(-1, 1.7)).toBeCloseTo(-1, 9)
  })

  test('is symmetric: f(-x) === -f(x)', () => {
    for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(applyGammaCurve(-x, 1.7)).toBeCloseTo(-applyGammaCurve(x, 1.7), 9)
    }
  })

  test('identity at gamma = 1', () => {
    for (const x of [-1, -0.5, -0.1, 0.1, 0.5, 1]) {
      expect(applyGammaCurve(x, 1)).toBeCloseTo(x, 9)
    }
  })

  test('monotonic increasing on [0, 1] for gamma > 0', () => {
    const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]
    for (let i = 1; i < samples.length; i++) {
      const prev = applyGammaCurve(samples[i - 1]!, 1.7)
      const curr = applyGammaCurve(samples[i]!, 1.7)
      expect(curr).toBeGreaterThan(prev)
    }
  })

  test('out-of-range input is clamped to ±1 (documented contract)', () => {
    expect(applyGammaCurve(1.5, 1.7)).toBeCloseTo(1, 9)
    expect(applyGammaCurve(-1.5, 1.7)).toBeCloseTo(-1, 9)
  })
})

describe('accumulateWheelAngle', () => {
  test('clamps at +maxRad and -maxRad', () => {
    const max = 1
    expect(accumulateWheelAngle(0.9, 1000, 0.01, max)).toBe(max)
    expect(accumulateWheelAngle(-0.9, -1000, 0.01, max)).toBe(-max)
  })

  test('integrates linearly within bounds', () => {
    const result = accumulateWheelAngle(0.1, 50, 0.001, 10)
    expect(result).toBeCloseTo(0.1 + 50 * 0.001, 9)
  })
})

describe('applyDecay', () => {
  test('approaches exp(-rate*dt) for unit input', () => {
    const result = applyDecay(1.0, 1, 6)
    expect(result).toBeCloseTo(Math.exp(-6), 6)
  })

  test('preserves sign (no overshoot)', () => {
    expect(applyDecay(0.5, 0.1, 6)).toBeGreaterThan(0)
    expect(applyDecay(-0.5, 0.1, 6)).toBeLessThan(0)
    expect(applyDecay(0.5, 5, 6)).toBeGreaterThanOrEqual(0)
  })

  test('snaps tiny values to 0', () => {
    expect(applyDecay(0.00001, 1, 6)).toBe(0)
  })

  test('large dt (tab resume, 5s) snaps to 0', () => {
    expect(applyDecay(Math.PI, 5.0, 6)).toBe(0)
  })
})

describe('applyVariableRatio', () => {
  test('uses ratioAtRest at 0 km/h', () => {
    expect(applyVariableRatio(0.5, 0, 1.0, 0.5)).toBeCloseTo(0.5 * 1.0, 9)
  })

  test('uses ratioAtTop at 250 km/h (>= top threshold)', () => {
    expect(applyVariableRatio(0.5, 250, 1.0, 0.5)).toBeCloseTo(0.5 * 0.5, 9)
  })

  test('non-increasing in speed for fixed positive steer', () => {
    const speeds = [0, 50, 110, 180, 250]
    let prev = applyVariableRatio(0.8, speeds[0]!, 1.0, 0.5)
    for (let i = 1; i < speeds.length; i++) {
      const curr = applyVariableRatio(0.8, speeds[i]!, 1.0, 0.5)
      expect(curr).toBeLessThanOrEqual(prev + 1e-9)
      prev = curr
    }
  })
})

describe('full pipeline composition', () => {
  test('+5 px mouse delta at rest with one decay tick produces expected steer', () => {
    const cfg = DEFAULT_MOUSE_STEERING_CONFIG
    const dt = 1 / 120
    const maxRad = (cfg.maxWheelAngleDeg * Math.PI) / 180
    const accumulated = accumulateWheelAngle(0, 5, cfg.sensitivityRadPerPx, maxRad)
    const decayed = applyDecay(accumulated, dt, cfg.decayRatePerSec)
    const normalised = wheelAngleToSteer(decayed, maxRad)
    const curved = applyGammaCurve(normalised, cfg.gamma)
    const final = applyVariableRatio(curved, 0, cfg.ratioAtRest, cfg.ratioAtTopSpeed)

    const expectedAccumulated = 5 * cfg.sensitivityRadPerPx
    const expectedDecayed = expectedAccumulated * Math.exp(-cfg.decayRatePerSec * dt)
    const expectedNormalised = expectedDecayed / maxRad
    const expectedCurved =
      Math.sign(expectedNormalised) * Math.pow(Math.abs(expectedNormalised), cfg.gamma)
    const expectedFinal = expectedCurved * cfg.ratioAtRest
    expect(final).toBeCloseTo(expectedFinal, 9)
  })

  test('default config is calibrated: 200 px reaches >= 0.4 normalised before gamma', () => {
    const cfg = DEFAULT_MOUSE_STEERING_CONFIG
    const maxRad = (cfg.maxWheelAngleDeg * Math.PI) / 180
    const wheel = accumulateWheelAngle(0, 200, cfg.sensitivityRadPerPx, maxRad)
    const normalised = Math.abs(wheelAngleToSteer(wheel, maxRad))
    expect(normalised).toBeGreaterThanOrEqual(0.4)
  })
})

describe('NaN / Infinity safety', () => {
  test('all functions return finite output for NaN/Infinity inputs', () => {
    const bad = [NaN, Infinity, -Infinity]
    for (const v of bad) {
      expect(Number.isFinite(applyGammaCurve(v, 1.7))).toBe(true)
      expect(Number.isFinite(applyGammaCurve(0.5, v))).toBe(true)
      expect(Number.isFinite(accumulateWheelAngle(v, 1, 0.001, 10))).toBe(true)
      expect(Number.isFinite(accumulateWheelAngle(0, v, 0.001, 10))).toBe(true)
      expect(Number.isFinite(accumulateWheelAngle(0, 1, v, 10))).toBe(true)
      expect(Number.isFinite(accumulateWheelAngle(0, 1, 0.001, v))).toBe(true)
      expect(Number.isFinite(applyDecay(v, 1, 6))).toBe(true)
      expect(Number.isFinite(applyDecay(0.5, v, 6))).toBe(true)
      expect(Number.isFinite(applyDecay(0.5, 1, v))).toBe(true)
      expect(Number.isFinite(wheelAngleToSteer(v, 1))).toBe(true)
      expect(Number.isFinite(wheelAngleToSteer(0.5, v))).toBe(true)
      expect(Number.isFinite(applyVariableRatio(v, 100, 1, 0.5))).toBe(true)
      expect(Number.isFinite(applyVariableRatio(0.5, v, 1, 0.5))).toBe(true)
      expect(Number.isFinite(applyVariableRatio(0.5, 100, v, 0.5))).toBe(true)
      expect(Number.isFinite(applyVariableRatio(0.5, 100, 1, v))).toBe(true)
    }
  })
})
