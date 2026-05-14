import type { StoreApi } from 'zustand'
import { getLogger } from './ActionLogger'

type AnyStore = StoreApi<Record<string, unknown>>

interface StoreRegistration {
  name: string
  store: AnyStore
  unsub: () => void
}

const registrations: StoreRegistration[] = []

function shallowDiff(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, { prev: unknown; next: unknown }> | null {
  const changes: Record<string, { prev: unknown; next: unknown }> = {}
  let hasChanges = false

  for (const key of Object.keys(next)) {
    if (typeof next[key] === 'function') continue
    if (prev[key] !== next[key]) {
      changes[key] = { prev: prev[key], next: next[key] }
      hasChanges = true
    }
  }

  return hasChanges ? changes : null
}

export function watchStore(name: string, store: AnyStore): () => void {
  const logger = getLogger()
  let prevState = { ...store.getState() }

  const unsub = store.subscribe(state => {
    const diff = shallowDiff(prevState, state)
    if (!diff) return

    for (const [field, change] of Object.entries(diff)) {
      logger.log('state', `state.${name}.${field}`, `store:${name}`, {
        field,
        prev: change.prev,
        next: change.next,
      })
    }

    prevState = { ...state }
  })

  registrations.push({ name, store, unsub })
  return unsub
}

export function unwatchAll(): void {
  for (const reg of registrations) {
    reg.unsub()
  }
  registrations.length = 0
}
