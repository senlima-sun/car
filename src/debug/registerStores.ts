import type { StoreApi } from 'zustand'
import { registerAndWatchStore } from './index'
import { useGameStore } from '../stores/useGameStore'
import { useTireStore } from '../stores/useTireStore'
import { useErsStore } from '../stores/useErsStore'
import { useLapTimeStore } from '../stores/useLapTimeStore'
import { usePitStore } from '../stores/usePitStore'
import { useSurfaceStore } from '../stores/useSurfaceStore'
import { useActiveAeroStore } from '../stores/useActiveAeroStore'
import { useBrakeStore } from '../stores/useBrakeStore'
import { useAquaplaningStore } from '../stores/useAquaplaningStore'
import { useCarStore } from '../stores/useCarStore'
import { useSessionStore } from '../stores/useSessionStore'

type AnyStore = StoreApi<Record<string, unknown>>

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
    ['aquaplaning', useAquaplaningStore as unknown as AnyStore],
    ['car', useCarStore as unknown as AnyStore],
  ]

  return stores.map(([name, store]) => registerAndWatchStore(name, store))
}
