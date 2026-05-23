import { afterEach, describe, expect, test } from 'vitest'
import { useDevToolsStore } from './useDevToolsStore'

afterEach(() => {
  useDevToolsStore.getState().reset()
})

describe('useDevToolsStore', () => {
  test('dev-tool defaults: physics/weather/track closed at focusOrder 0', () => {
    const { panels } = useDevToolsStore.getState()
    expect(panels['physics-debug'].isOpen).toBe(false)
    expect(panels.weather.isOpen).toBe(false)
    expect(panels['track-switcher'].isOpen).toBe(false)
    expect(panels['wheel-visual'].isOpen).toBe(false)
    expect(panels['physics-debug'].focusOrder).toBe(0)
  })

  test('HUD-panel defaults: minimap + car-status open', () => {
    const { panels } = useDevToolsStore.getState()
    expect(panels.minimap.isOpen).toBe(true)
    expect(panels['car-status'].isOpen).toBe(true)
  })

  test('togglePanel opens a closed panel and assigns top focusOrder', () => {
    useDevToolsStore.getState().togglePanel('physics-debug')
    const { panels } = useDevToolsStore.getState()
    expect(panels['physics-debug'].isOpen).toBe(true)
    expect(panels['physics-debug'].focusOrder).toBe(1)
  })

  test('togglePanel twice closes the panel', () => {
    useDevToolsStore.getState().togglePanel('physics-debug')
    useDevToolsStore.getState().togglePanel('physics-debug')
    expect(useDevToolsStore.getState().panels['physics-debug'].isOpen).toBe(false)
  })

  test('openPanel idempotent', () => {
    useDevToolsStore.getState().openPanel('weather')
    const first = useDevToolsStore.getState().panels.weather.focusOrder
    useDevToolsStore.getState().openPanel('weather')
    const second = useDevToolsStore.getState().panels.weather.focusOrder
    expect(second).toBeGreaterThan(first)
    expect(useDevToolsStore.getState().panels.weather.isOpen).toBe(true)
  })

  test('closePanel closes without altering focusOrder', () => {
    useDevToolsStore.getState().openPanel('weather')
    const fo = useDevToolsStore.getState().panels.weather.focusOrder
    useDevToolsStore.getState().closePanel('weather')
    expect(useDevToolsStore.getState().panels.weather.isOpen).toBe(false)
    expect(useDevToolsStore.getState().panels.weather.focusOrder).toBe(fo)
  })

  test('setPanelPosition writes new position', () => {
    useDevToolsStore.getState().setPanelPosition('physics-debug', { x: 500, y: 200 })
    expect(useDevToolsStore.getState().panels['physics-debug'].position).toEqual({
      x: 500,
      y: 200,
    })
  })

  test('bringToFront makes a panel highest', () => {
    const s = useDevToolsStore.getState()
    s.openPanel('physics-debug')
    s.openPanel('weather')
    s.bringToFront('physics-debug')
    const { panels } = useDevToolsStore.getState()
    expect(panels['physics-debug'].focusOrder).toBeGreaterThan(panels.weather.focusOrder)
  })

  test('bringToFront monotonic across many calls', () => {
    const s = useDevToolsStore.getState()
    s.openPanel('physics-debug')
    s.openPanel('weather')
    s.bringToFront('weather')
    s.bringToFront('physics-debug')
    s.bringToFront('weather')
    const { panels } = useDevToolsStore.getState()
    expect(panels.weather.focusOrder).toBeGreaterThan(panels['physics-debug'].focusOrder)
  })

  test('reset returns to defaults', () => {
    const s = useDevToolsStore.getState()
    s.openPanel('physics-debug')
    s.setPanelPosition('weather', { x: 999, y: 999 })
    s.reset()
    const { panels } = useDevToolsStore.getState()
    expect(panels['physics-debug'].isOpen).toBe(false)
    expect(panels.weather.position).toEqual({ x: 320, y: 80 })
  })
})
