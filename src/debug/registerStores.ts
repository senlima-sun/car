import type { StoreApi } from 'zustand'
import { registerAndWatchStore } from './index'

type AnyStore = StoreApi<Record<string, unknown>>

export function registerAllStores(): (() => void)[] {
  const unsubs: (() => void)[] = []

  const stores: [string, () => Promise<{ default?: AnyStore } & Record<string, AnyStore>>][] = [
    ['game', () => import('../stores/useGameStore').then(m => ({ default: m.useGameStore as unknown as AnyStore }))],
    ['tire', () => import('../stores/useTireStore').then(m => ({ default: m.useTireStore as unknown as AnyStore }))],
    ['ers', () => import('../stores/useErsStore').then(m => ({ default: m.useErsStore as unknown as AnyStore }))],
    ['lapTime', () => import('../stores/useLapTimeStore').then(m => ({ default: m.useLapTimeStore as unknown as AnyStore }))],
    ['pit', () => import('../stores/usePitStore').then(m => ({ default: m.usePitStore as unknown as AnyStore }))],
    ['surface', () => import('../stores/useSurfaceStore').then(m => ({ default: m.useSurfaceStore as unknown as AnyStore }))],
    ['activeAero', () => import('../stores/useActiveAeroStore').then(m => ({ default: m.useActiveAeroStore as unknown as AnyStore }))],
    ['brake', () => import('../stores/useBrakeStore').then(m => ({ default: m.useBrakeStore as unknown as AnyStore }))],
    ['aquaplaning', () => import('../stores/useAquaplaningStore').then(m => ({ default: m.useAquaplaningStore as unknown as AnyStore }))],
    ['car', () => import('../stores/useCarStore').then(m => ({ default: m.useCarStore as unknown as AnyStore }))],
  ]

  for (const [name, loader] of stores) {
    loader().then(mod => {
      if (mod.default) {
        unsubs.push(registerAndWatchStore(name, mod.default))
      }
    })
  }

  return unsubs
}
