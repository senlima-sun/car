import type { RibbonBoundary } from './ribbonBoundary'

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
