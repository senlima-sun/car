import type { BufferGeometry } from 'three'
import type { PlacedObject } from '@/types/trackObjects'
import { resolveParentDerivedLayer, type ResolveContext } from '@/utils/parentDerivedLayer'
import { getRibbonBoundary } from './ribbonBoundaryCache'
import {
  buildAsphaltGeometry,
  buildEdgeLineFromBoundary,
  buildEdgeLineGeometry,
  buildParentSideBandGeometry,
  buildSideBandFromBoundary,
} from './ribbonGeometry'

const DEFAULT_PARENT_WIDTH = 12

function isFullParentRange(range: [number, number] | undefined): boolean {
  return range === undefined || (range[0] === 0 && range[1] === 1)
}

function fallbackContext(
  parentRibbon: PlacedObject | undefined,
  allObjects?: readonly PlacedObject[],
): ResolveContext {
  if (allObjects) return { allObjects }
  return { parent: parentRibbon }
}

export function resolveEdgeLineGeometries(
  placed: PlacedObject,
  parentRibbon: PlacedObject | undefined,
  defaultLineWidth: number,
  allObjects?: readonly PlacedObject[],
): BufferGeometry[] {
  const lineWidth = placed.derivedWidth ?? placed.width ?? defaultLineWidth

  if (parentRibbon && placed.parentSide && !placed.tRange) {
    const boundary = getRibbonBoundary(parentRibbon.id)
    if (boundary) {
      const built = buildEdgeLineFromBoundary(boundary, placed.parentSide, lineWidth)
      return built ? [built.geometry] : []
    }
    if (parentRibbon.ribbonPoints && parentRibbon.ribbonPoints.length >= 2) {
      const built = buildEdgeLineGeometry(
        parentRibbon.ribbonPoints,
        parentRibbon.ribbonClosed ?? false,
        parentRibbon.width ?? DEFAULT_PARENT_WIDTH,
        placed.parentSide,
        lineWidth,
      )
      return built ? [built.geometry] : []
    }
  }

  if (!parentRibbon && !placed.tRange && !allObjects) return []

  const segments = resolveParentDerivedLayer(placed, fallbackContext(parentRibbon, allObjects))
  const out: BufferGeometry[] = []
  for (const seg of segments) {
    if (seg.points.length < 2) continue
    const built = buildAsphaltGeometry(seg.points, seg.closed, seg.width)
    if (built) out.push(built.geometry)
  }
  return out
}

export interface ResolvedSideBand {
  geometry: BufferGeometry
  positions: Float32Array
  indices: number[]
}

export function resolveSideBandGeometries(
  placed: PlacedObject,
  parentRibbon: PlacedObject | undefined,
  defaultBandWidth: number,
  allObjects?: readonly PlacedObject[],
): ResolvedSideBand[] {
  const bandWidth = placed.derivedWidth ?? placed.width ?? defaultBandWidth
  const innerOffset = placed.innerOffset ?? 0

  if (parentRibbon && placed.parentSide && isFullParentRange(placed.tRange)) {
    const boundary = getRibbonBoundary(parentRibbon.id)
    if (boundary) {
      const result = buildSideBandFromBoundary(boundary, placed.parentSide, innerOffset, bandWidth)
      return result && result.indices.length > 0
        ? [{ geometry: result.geometry, positions: result.positions, indices: result.indices }]
        : []
    }
    if (parentRibbon.ribbonPoints && parentRibbon.ribbonPoints.length >= 2) {
      const result = buildParentSideBandGeometry(
        parentRibbon.ribbonPoints,
        parentRibbon.ribbonClosed ?? false,
        parentRibbon.width ?? DEFAULT_PARENT_WIDTH,
        placed.parentSide,
        innerOffset,
        bandWidth,
      )
      return result && result.indices.length > 0
        ? [{ geometry: result.geometry, positions: result.positions, indices: result.indices }]
        : []
    }
  }

  const segments = resolveParentDerivedLayer(placed, fallbackContext(parentRibbon, allObjects))
  const out: ResolvedSideBand[] = []
  for (const seg of segments) {
    if (seg.points.length < 2) continue
    const result = buildAsphaltGeometry(seg.points, seg.closed, seg.width)
    if (!result || result.mainIndices.length === 0) continue
    out.push({ geometry: result.geometry, positions: result.positions, indices: result.mainIndices })
  }
  return out
}
