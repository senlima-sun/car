import type { PlacedObject } from '@/types/trackObjects'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { buildRibbonBoundary, type RibbonBoundary } from './ribbonBoundary'

const cache = new Map<string, RibbonBoundary>()

export function setRibbonBoundary(id: string, boundary: RibbonBoundary): void {
  cache.set(id, boundary)
}

export function getRibbonBoundary(id: string): RibbonBoundary | undefined {
  return cache.get(id)
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
  const built = buildRibbonBoundary(
    obj.ribbonPoints!,
    obj.ribbonClosed ?? false,
    obj.width ?? TRACK_WIDTH,
  )
  if (built) cache.set(obj.id, built)
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
