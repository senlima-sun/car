import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  useStartLightsStore,
  LIGHT_INTERVAL_MS,
  START_LIGHTS_COLUMNS,
  HOLD_MIN_MS,
  HOLD_MAX_MS,
  GO_FLASH_MS,
} from './useStartLightsStore'

const reset = () => useStartLightsStore.getState().reset()

describe('useStartLightsStore', () => {
  const originalRandom = Math.random

  beforeEach(() => {
    reset()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    Math.random = originalRandom
  })

  test('starts in idle status with no lit columns', () => {
    const s = useStartLightsStore.getState()
    expect(s.status).toBe('idle')
    expect(s.litColumns).toBe(0)
    expect(s.isInputLocked()).toBe(false)
  })

  test('arm transitions to lighting and locks input', () => {
    useStartLightsStore.getState().arm('manual', 0)
    const s = useStartLightsStore.getState()
    expect(s.status).toBe('lighting')
    expect(s.trigger).toBe('manual')
    expect(s.isInputLocked()).toBe(true)
  })

  test('tick illuminates one column per LIGHT_INTERVAL_MS', () => {
    const store = useStartLightsStore.getState()
    store.arm('session', 0)

    store.tick(LIGHT_INTERVAL_MS * 1)
    expect(useStartLightsStore.getState().litColumns).toBe(2)

    store.tick(LIGHT_INTERVAL_MS * 2)
    expect(useStartLightsStore.getState().litColumns).toBe(3)

    store.tick(LIGHT_INTERVAL_MS * 3)
    expect(useStartLightsStore.getState().litColumns).toBe(4)
  })

  test('all columns lit advances to hold status', () => {
    const store = useStartLightsStore.getState()
    store.arm('session', 0)
    store.tick(LIGHT_INTERVAL_MS * (START_LIGHTS_COLUMNS - 1))
    const s = useStartLightsStore.getState()
    expect(s.status).toBe('hold')
    expect(s.litColumns).toBe(START_LIGHTS_COLUMNS)
    expect(s.isInputLocked()).toBe(true)
  })

  test('hold elapses to go after holdDurationMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const store = useStartLightsStore.getState()
    store.arm('session', 0)
    store.tick(LIGHT_INTERVAL_MS * (START_LIGHTS_COLUMNS - 1))

    const holdStart = LIGHT_INTERVAL_MS * (START_LIGHTS_COLUMNS - 1)
    store.tick(holdStart + HOLD_MIN_MS - 1)
    expect(useStartLightsStore.getState().status).toBe('hold')

    store.tick(holdStart + HOLD_MIN_MS + 1)
    expect(useStartLightsStore.getState().status).toBe('go')
    expect(useStartLightsStore.getState().isInputLocked()).toBe(false)
  })

  test('hold duration respects HOLD_MAX_MS upper bound', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    const store = useStartLightsStore.getState()
    store.arm('session', 0)
    const holdDuration = useStartLightsStore.getState().holdDurationMs
    expect(holdDuration).toBeGreaterThanOrEqual(HOLD_MIN_MS)
    expect(holdDuration).toBeLessThanOrEqual(HOLD_MAX_MS)
  })

  test('go status returns to idle after GO_FLASH_MS', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const store = useStartLightsStore.getState()
    store.arm('manual', 0)
    store.tick(LIGHT_INTERVAL_MS * (START_LIGHTS_COLUMNS - 1))
    const holdStart = LIGHT_INTERVAL_MS * (START_LIGHTS_COLUMNS - 1)
    store.tick(holdStart + HOLD_MIN_MS + 1)
    expect(useStartLightsStore.getState().status).toBe('go')

    const goTime = useStartLightsStore.getState().goEnteredAt!
    store.tick(goTime + GO_FLASH_MS + 1)
    expect(useStartLightsStore.getState().status).toBe('idle')
  })

  test('cancel resets to idle from any status', () => {
    const store = useStartLightsStore.getState()
    store.arm('session', 0)
    store.tick(LIGHT_INTERVAL_MS * 2)
    expect(useStartLightsStore.getState().status).toBe('lighting')

    store.cancel()
    expect(useStartLightsStore.getState().status).toBe('idle')
    expect(useStartLightsStore.getState().litColumns).toBe(0)
    expect(useStartLightsStore.getState().isInputLocked()).toBe(false)
  })

  test('tick on idle status is a no-op', () => {
    useStartLightsStore.getState().tick(99999)
    expect(useStartLightsStore.getState().status).toBe('idle')
  })

  test('isInputLocked is true during lighting and hold, false otherwise', () => {
    const store = useStartLightsStore.getState()
    expect(store.isInputLocked()).toBe(false)

    store.arm('manual', 0)
    expect(useStartLightsStore.getState().isInputLocked()).toBe(true)

    store.tick(LIGHT_INTERVAL_MS * (START_LIGHTS_COLUMNS - 1))
    expect(useStartLightsStore.getState().isInputLocked()).toBe(true)

    const holdStart = LIGHT_INTERVAL_MS * (START_LIGHTS_COLUMNS - 1)
    store.tick(holdStart + HOLD_MIN_MS + 1)
    expect(useStartLightsStore.getState().isInputLocked()).toBe(false)
  })
})
