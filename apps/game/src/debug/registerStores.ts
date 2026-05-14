import type { StoreApi } from 'zustand'
import { registerAndWatchStore, registerStore } from './index'
import { useGameStore } from '../stores/useGameStore'
import { useTireStore } from '../stores/useTireStore'
import { useErsStore } from '../stores/useErsStore'
import { useLapTimeStore } from '../stores/useLapTimeStore'
import { usePitStore } from '../stores/usePitStore'
import { useSurfaceStore } from '../stores/useSurfaceStore'
import { useActiveAeroStore } from '../stores/useActiveAeroStore'
import { useBrakeStore } from '../stores/useBrakeStore'
import { useCarStore } from '../stores/useCarStore'
import { useSessionStore } from '../stores/useSessionStore'

type AnyStore = StoreApi<Record<string, unknown>>

function shouldWatch(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('devToolsWatchStores') === '1'
  } catch {
    return false
  }
}

export function registerAllStores(): (() => void)[] {
  const stores: [string, AnyStore][] = [
    ['game', useGameStore as unknown as AnyStore],
    ['session', useSessionStore as unknown as AnyStore],
    ['tire', useTireStore as unknown as AnyStore],
    ['ers', useErsStore as unknown as AnyStore],
    ['lapTime', useLapTimeStore as unknown as AnyStore],
    ['pit', usePitStore as unknown as AnyStore],
    ['surface', useSurfaceStore as unknown as AnyStore],
    ['activeAero', useActiveAeroStore as unknown as AnyStore],
    ['brake', useBrakeStore as unknown as AnyStore],
    ['car', useCarStore as unknown as AnyStore],
  ]

  const watch = shouldWatch()
  return stores.map(([name, store]) => {
    if (watch) return registerAndWatchStore(name, store)
    registerStore(name, store)
    return () => {}
  })
}
