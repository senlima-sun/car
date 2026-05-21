import { describe, expect, test } from 'vitest'
import { DEV_TOOLS_HOTKEY_MAP, handleDevToolsHotkey } from './useDevToolsHotkeys'
import type { DevPanelId } from '../stores/useDevToolsStore'

function makeEvent(code: string): KeyboardEvent & { preventCalled: boolean } {
  const event = {
    code,
    preventCalled: false,
    preventDefault() {
      this.preventCalled = true
    },
  }
  return event as unknown as KeyboardEvent & { preventCalled: boolean }
}

describe('DEV_TOOLS_HOTKEY_MAP', () => {
  test('F7 → weather', () => {
    expect(DEV_TOOLS_HOTKEY_MAP.F7).toBe('weather')
  })
  test('F8 → track-switcher', () => {
    expect(DEV_TOOLS_HOTKEY_MAP.F8).toBe('track-switcher')
  })
  test('F9 → physics-debug', () => {
    expect(DEV_TOOLS_HOTKEY_MAP.F9).toBe('physics-debug')
  })
})

describe('handleDevToolsHotkey', () => {
  test('returns true and toggles for F7', () => {
    const event = makeEvent('F7')
    const toggled: DevPanelId[] = []
    const handled = handleDevToolsHotkey(event, id => toggled.push(id))
    expect(handled).toBe(true)
    expect(toggled).toEqual(['weather'])
    expect(event.preventCalled).toBe(true)
  })

  test('returns true and toggles for F8', () => {
    const event = makeEvent('F8')
    const toggled: DevPanelId[] = []
    handleDevToolsHotkey(event, id => toggled.push(id))
    expect(toggled).toEqual(['track-switcher'])
  })

  test('returns true and toggles for F9', () => {
    const event = makeEvent('F9')
    const toggled: DevPanelId[] = []
    handleDevToolsHotkey(event, id => toggled.push(id))
    expect(toggled).toEqual(['physics-debug'])
  })

  test('returns false for unrelated key — no toggle, no preventDefault', () => {
    const event = makeEvent('F5')
    const toggled: DevPanelId[] = []
    const handled = handleDevToolsHotkey(event, id => toggled.push(id))
    expect(handled).toBe(false)
    expect(toggled).toEqual([])
    expect(event.preventCalled).toBe(false)
  })
})
