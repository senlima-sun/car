import type { PlacedObject } from '@/types/trackObjects'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { buildRibbonBoundary, type RibbonBoundary } from './ribbonBoundary'

interface CacheEntry {
  key: string
  boundary: RibbonBoundary
}

const cache = new Map<string, CacheEntry>()

function hashPoints(points: PlacedObject['ribbonPoints']): number {
  if (!points) return 0
  let h = 2166136261
  for (const p of points) {
    h = Math.imul(h ^ Math.round(p.x * 1000), 16777619)
    h = Math.imul(h ^ Math.round(p.z * 1000), 16777619)
  }
  return h >>> 0
}

function entryKey(obj: PlacedObject, generation: number): string {
  return `${obj.width ?? TRACK_WIDTH}|${obj.ribbonClosed ? 1 : 0}|${hashPoints(obj.ribbonPoints)}|${generation}`
}

export function setRibbonBoundary(id: string, boundary: RibbonBoundary): void {
  cache.set(id, { key: '', boundary })
}

export function getRibbonBoundary(id: string): RibbonBoundary | undefined {
  return cache.get(id)?.boundary
}

export function clearRibbonBoundary(id: string): void {
  cache.delete(id)
}

export function clearAllRibbonBoundaries(): void {
  cache.clear()
}

function isTrackRibbon(obj: PlacedObject): boolean {
  return obj.type === 'track_ribbon' && Array.isArray(obj.ribbonPoints) && obj.ribbonPoints.length >= 2
}

export function rebuildRibbonBoundaryFor(obj: PlacedObject): void {
  if (!isTrackRibbon(obj)) {
    cache.delete(obj.id)
    return
  }
  const generation = useTerrainStore.getState().terrainGeneration
  const key = entryKey(obj, generation)
  const existing = cache.get(obj.id)
  if (existing && existing.key === key) return
  const built = buildRibbonBoundary(
    obj.ribbonPoints!,
    obj.ribbonClosed ?? false,
    obj.width ?? TRACK_WIDTH,
    undefined,
    useTerrainStore.getState().getHeightAt,
  )
  if (built) cache.set(obj.id, { key, boundary: built })
  else cache.delete(obj.id)
}

export function syncRibbonBoundaries(objects: readonly PlacedObject[]): void {
  const liveIds = new Set<string>()
  for (const obj of objects) {
    if (!isTrackRibbon(obj)) continue
    liveIds.add(obj.id)
    rebuildRibbonBoundaryFor(obj)
  }
  for (const id of cache.keys()) {
    if (!liveIds.has(id)) cache.delete(id)
  }
}
