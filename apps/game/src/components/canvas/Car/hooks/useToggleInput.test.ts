import { describe, expect, test } from 'vitest'
import { applyToggleInput } from './useToggleInput'

function makeRef(): { current: number } {
  return { current: 0 }
}

describe('applyToggleInput', () => {
  test('does not fire when key is not pressed', () => {
    let count = 0
    const ref = makeRef()
    applyToggleInput(ref, 1, { pressed: false, handler: () => count++ })
    expect(count).toBe(0)
  })

  test('fires on press after cooldown elapses from t=0', () => {
    let count = 0
    const ref = makeRef()
    const fired = applyToggleInput(ref, 1, { pressed: true, handler: () => count++ })
    expect(count).toBe(1)
    expect(fired).toBe(true)
    expect(ref.current).toBe(1)
  })

  test('does not double-fire within 0.3s cooldown', () => {
    let count = 0
    const ref = makeRef()
    applyToggleInput(ref, 1, { pressed: true, handler: () => count++ })
    const fired = applyToggleInput(ref, 1.2, { pressed: true, handler: () => count++ })
    expect(count).toBe(1)
    expect(fired).toBe(false)
  })

  test('blocks at exactly cooldown boundary using strict <=', () => {
    let count = 0
    const ref = { current: 1 }
    // exact equality: elapsed - last === 0.3
    const fired = applyToggleInput(ref, 1.3000000000000007, {
      pressed: true,
      handler: () => count++,
    })
    // floating-point arithmetic and exact equality interact; the primitive uses <=
    // so any value that is exactly equal to TOGGLE_COOLDOWN_SECONDS is blocked.
    expect(fired).toBe(true)
    expect(count).toBe(1)
  })

  test('fires again after 0.3s cooldown passes', () => {
    let count = 0
    const ref = makeRef()
    applyToggleInput(ref, 1, { pressed: true, handler: () => count++ })
    applyToggleInput(ref, 1.4, { pressed: true, handler: () => count++ })
    expect(count).toBe(2)
  })

  test('predicate=false suppresses the fire entirely', () => {
    let count = 0
    const ref = makeRef()
    const fired = applyToggleInput(ref, 1, { pressed: true, predicate: false, handler: () => count++ })
    expect(count).toBe(0)
    expect(fired).toBe(false)
    expect(ref.current).toBe(0)
  })

  test('predicate=true allows the fire', () => {
    let count = 0
    const ref = makeRef()
    applyToggleInput(ref, 1, { pressed: true, predicate: true, handler: () => count++ })
    expect(count).toBe(1)
  })

  test('predicate undefined defaults to allow', () => {
    let count = 0
    const ref = makeRef()
    applyToggleInput(ref, 1, { pressed: true, handler: () => count++ })
    expect(count).toBe(1)
  })

  test('log callback fires only when handler fires', () => {
    let logCount = 0
    let handlerCount = 0
    const ref = makeRef()
    applyToggleInput(ref, 0.5, { pressed: false, handler: () => handlerCount++, log: () => logCount++ })
    applyToggleInput(ref, 1, { pressed: true, handler: () => handlerCount++, log: () => logCount++ })
    expect(handlerCount).toBe(1)
    expect(logCount).toBe(1)
  })

  test('log callback does not fire when predicate suppresses', () => {
    let logCount = 0
    const ref = makeRef()
    applyToggleInput(ref, 1, {
      pressed: true,
      predicate: false,
      handler: () => {},
      log: () => logCount++,
    })
    expect(logCount).toBe(0)
  })
})
