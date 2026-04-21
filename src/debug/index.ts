import { createLogger } from './ActionLogger'
import { watchStore } from './storeLogger'
import { registerAllStores } from './registerStores'
import type { StoreApi } from 'zustand'
import { IS_DEV } from '../utils/isDev'

export { getLogger, createLogger } from './ActionLogger'
export { watchStore, unwatchAll } from './storeLogger'
export type {
  ActionEntry,
  ActionFilter,
  ActionCategory,
  ActionLoggerConfig,
} from './ActionLogger.types'

type AnyStore = StoreApi<Record<string, unknown>>

const storeRegistry: Record<string, () => Record<string, unknown>> = {}

export function registerStore(name: string, store: AnyStore): void {
  storeRegistry[name] = () => {
    const state = store.getState()
    const snapshot: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(state)) {
      if (typeof v !== 'function') snapshot[k] = v
    }
    return snapshot
  }
}

function getStoreSnapshots(): Record<string, Record<string, unknown>> {
  const snapshots: Record<string, Record<string, unknown>> = {}
  for (const [name, getState] of Object.entries(storeRegistry)) {
    snapshots[name] = getState()
  }
  return snapshots
}

export function initDevTools(): void {
  if (!IS_DEV) return

  const logger = createLogger({ maxEntries: 2000 })

  window.__DEV_LOGGER__ = logger
  window.__DEV_STORES__ = getStoreSnapshots

  logger.log('system', 'system.devtools.init', 'debug', { timestamp: Date.now() })

  registerAllStores()
}

export function registerAndWatchStore(name: string, store: AnyStore): () => void {
  registerStore(name, store)
  return watchStore(name, store)
}
