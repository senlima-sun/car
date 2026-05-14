import { useRef, useCallback } from 'react'

const TOGGLE_COOLDOWN_SECONDS = 0.3

export interface ToggleInputBinding {
  pressed: boolean
  predicate?: boolean
  handler: () => void
  log?: () => void
}

export function applyToggleInput(
  lastToggleRef: { current: number },
  elapsedTime: number,
  binding: ToggleInputBinding,
): boolean {
  if (binding.predicate === false) return false
  if (!binding.pressed) return false
  if (elapsedTime - lastToggleRef.current <= TOGGLE_COOLDOWN_SECONDS) return false

  binding.handler()
  binding.log?.()
  lastToggleRef.current = elapsedTime
  return true
}

export function useToggleInput() {
  const lastToggleRef = useRef(0)

  return useCallback(
    (elapsedTime: number, binding: ToggleInputBinding) =>
      applyToggleInput(lastToggleRef, elapsedTime, binding),
    [],
  )
}
