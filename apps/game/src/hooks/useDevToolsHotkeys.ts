import { useEffect } from 'react'
import { useDevToolsStore, type DevPanelId } from '../stores/useDevToolsStore'
import { useStartLightsStore } from '../stores/useStartLightsStore'

export const DEV_TOOLS_HOTKEY_MAP: Record<string, DevPanelId> = {
  F6: 'steering-debug',
  F7: 'weather',
  F8: 'track-switcher',
  F9: 'physics-debug',
}

export type DevActionId = 'start-lights'

export const DEV_ACTION_HOTKEY_MAP: Record<string, DevActionId> = {
  F4: 'start-lights',
}

const DEV_ACTIONS: Record<DevActionId, () => void> = {
  'start-lights': () => {
    const lights = useStartLightsStore.getState()
    if (lights.status === 'idle') lights.arm('manual')
  },
}

export function handleDevToolsHotkey(
  event: KeyboardEvent,
  toggle: (id: DevPanelId) => void,
): boolean {
  const action = DEV_ACTION_HOTKEY_MAP[event.code]
  if (action) {
    event.preventDefault()
    DEV_ACTIONS[action]()
    return true
  }
  const target = DEV_TOOLS_HOTKEY_MAP[event.code]
  if (!target) return false
  event.preventDefault()
  toggle(target)
  return true
}

export function useDevToolsHotkeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    function onKey(event: KeyboardEvent) {
      handleDevToolsHotkey(event, useDevToolsStore.getState().togglePanel)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

export function runDevAction(id: DevActionId): void {
  DEV_ACTIONS[id]()
}
