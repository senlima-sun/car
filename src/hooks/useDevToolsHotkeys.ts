import { useEffect } from 'react'
import { useDevToolsStore, type DevPanelId } from '../stores/useDevToolsStore'

export const DEV_TOOLS_HOTKEY_MAP: Record<string, DevPanelId> = {
  F7: 'weather',
  F8: 'track-switcher',
  F9: 'physics-debug',
}

export function handleDevToolsHotkey(
  event: KeyboardEvent,
  toggle: (id: DevPanelId) => void,
): boolean {
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
