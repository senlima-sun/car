import { afterEach, describe, expect, test } from 'bun:test'
import {
  consumeAndSteer,
  getSteeringConfig,
  getWheelAngleRad,
  handleSteeringMouseMove,
  isLockActive,
  peekSteer,
  resetSteering,
  setSteeringConfig,
  setSteeringHold,
  setSteeringLocked,
} from './mouseSteeringState'
import { DEFAULT_MOUSE_STEERING_CONFIG } from './steeringMath'

afterEach(() => {
  resetSteering()
  setSteeringConfig(DEFAULT_MOUSE_STEERING_CONFIG)
})

function fakeMouseEvent(movementX: number): MouseEvent {
  return { movementX } as unknown as MouseEvent
}

describe('mouseSteeringState', () => {
  test('handleSteeringMouseMove discards events when not locked', () => {
    setSteeringLocked(false)
    handleSteeringMouseMove(fakeMouseEvent(500))
    handleSteeringMouseMove(fakeMouseEvent(500))
    const steer = consumeAndSteer(0, 1 / 120)
    expect(steer).toBe(0)
    expect(getWheelAngleRad()).toBe(0)
  })

  test('consumeAndSteer with no input decays toward zero', () => {
    setSteeringLocked(true)
    handleSteeringMouseMove(fakeMouseEvent(100))
    const first = consumeAndSteer(0, 1 / 120)
    expect(Math.abs(first)).toBeGreaterThan(0)
    let last = first
    for (let i = 0; i < 200; i++) {
      last = consumeAndSteer(0, 1 / 120)
    }
    expect(last).toBe(0)
    expect(getWheelAngleRad()).toBe(0)
  })

  test('peekSteer returns last consumed steer without mutating state', () => {
    setSteeringLocked(true)
    handleSteeringMouseMove(fakeMouseEvent(50))
    const consumed = consumeAndSteer(0, 1 / 120)
    expect(peekSteer()).toBeCloseTo(consumed, 9)
    const peeked = peekSteer()
    expect(peekSteer()).toBe(peeked)
  })

  test('resetSteering clears all state', () => {
    setSteeringLocked(true)
    handleSteeringMouseMove(fakeMouseEvent(200))
    consumeAndSteer(0, 1 / 120)
    expect(getWheelAngleRad()).not.toBe(0)
    expect(isLockActive()).toBe(true)
    resetSteering()
    expect(getWheelAngleRad()).toBe(0)
    expect(isLockActive()).toBe(false)
    expect(peekSteer()).toBe(0)
  })

  test('setSteeringLocked(false) clears pending delta and wheel angle', () => {
    setSteeringLocked(true)
    handleSteeringMouseMove(fakeMouseEvent(80))
    setSteeringLocked(false)
    expect(getWheelAngleRad()).toBe(0)
    const steer = consumeAndSteer(0, 1 / 120)
    expect(steer).toBe(0)
  })

  test('setSteeringConfig clamps wheelAngle when max shrinks mid-session', () => {
    setSteeringLocked(true)
    handleSteeringMouseMove(fakeMouseEvent(2000))
    consumeAndSteer(0, 1 / 120)
    const before = Math.abs(getWheelAngleRad())
    expect(before).toBeGreaterThan(0)
    setSteeringConfig({ ...DEFAULT_MOUSE_STEERING_CONFIG, maxWheelAngleDeg: 90 })
    const newMaxRad = (90 * Math.PI) / 180
    expect(Math.abs(getWheelAngleRad())).toBeLessThanOrEqual(newMaxRad + 1e-9)
  })

  test('setSteeringConfig validates legacy/invalid input', () => {
    setSteeringConfig({ sensitivityRadPerPx: -5, gamma: 'oops' } as unknown)
    const cfg = getSteeringConfig()
    expect(cfg.sensitivityRadPerPx).toBe(DEFAULT_MOUSE_STEERING_CONFIG.sensitivityRadPerPx)
    expect(cfg.gamma).toBe(DEFAULT_MOUSE_STEERING_CONFIG.gamma)
  })

  test('hold prevents decay until released', () => {
    setSteeringLocked(true)
    handleSteeringMouseMove(fakeMouseEvent(80))
    consumeAndSteer(0, 1 / 120)
    const held = getWheelAngleRad()
    expect(Math.abs(held)).toBeGreaterThan(0)

    setSteeringHold(true)
    for (let i = 0; i < 600; i++) {
      consumeAndSteer(0, 1 / 120)
    }
    expect(getWheelAngleRad()).toBe(held)

    setSteeringHold(false)
    for (let i = 0; i < 600; i++) {
      consumeAndSteer(0, 1 / 120)
    }
    expect(getWheelAngleRad()).toBe(0)
  })

  test('mouse movement during hold still updates angle', () => {
    setSteeringLocked(true)
    setSteeringHold(true)
    handleSteeringMouseMove(fakeMouseEvent(50))
    consumeAndSteer(0, 1 / 120)
    expect(getWheelAngleRad()).toBeCloseTo(
      50 * DEFAULT_MOUSE_STEERING_CONFIG.sensitivityRadPerPx,
      9,
    )
  })

  test('resetSteering clears hold flag', () => {
    setSteeringLocked(true)
    setSteeringHold(true)
    resetSteering()
    setSteeringLocked(true)
    handleSteeringMouseMove(fakeMouseEvent(50))
    consumeAndSteer(0, 1 / 120)
    const after = getWheelAngleRad()
    let v = after
    for (let i = 0; i < 600; i++) {
      v = consumeAndSteer(0, 1 / 120)
      void v
    }
    expect(getWheelAngleRad()).toBe(0)
  })
})
