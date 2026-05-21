import { beforeEach, describe, expect, test } from 'vitest'
import {
  clearAllRibbonBoundaries,
  clearRibbonBoundary,
  getRibbonBoundary,
  setRibbonBoundary,
} from './ribbonBoundaryCache'
import { buildRibbonBoundary } from './ribbonBoundary'
import { buildEdgeLineFromBoundary } from './ribbonGeometry'
import type { TrackRibbonPoint } from '@/types/trackObjects'

const STRAIGHT: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 0, isPitLane: false },
]

beforeEach(() => {
  clearAllRibbonBoundaries()
})

describe('ribbonBoundaryCache', () => {
  test('set/get round-trip returns the same object', () => {
    const boundary = buildRibbonBoundary(STRAIGHT, false, 12)!
    setRibbonBoundary('test-id', boundary)
    expect(getRibbonBoundary('test-id')).toBe(boundary)
  })

  test('get returns undefined for missing id', () => {
    expect(getRibbonBoundary('nonexistent')).toBeUndefined()
  })

  test('clearRibbonBoundary removes specific entry', () => {
    const boundary = buildRibbonBoundary(STRAIGHT, false, 12)!
    setRibbonBoundary('a', boundary)
    setRibbonBoundary('b', boundary)
    clearRibbonBoundary('a')
    expect(getRibbonBoundary('a')).toBeUndefined()
    expect(getRibbonBoundary('b')).toBe(boundary)
  })

  test('clearAllRibbonBoundaries empties the cache', () => {
    const boundary = buildRibbonBoundary(STRAIGHT, false, 12)!
    setRibbonBoundary('x', boundary)
    setRibbonBoundary('y', boundary)
    clearAllRibbonBoundaries()
    expect(getRibbonBoundary('x')).toBeUndefined()
    expect(getRibbonBoundary('y')).toBeUndefined()
  })

  test('overwriting an id replaces the previous value', () => {
    const b1 = buildRibbonBoundary(STRAIGHT, false, 12)!
    const b2 = buildRibbonBoundary(STRAIGHT, false, 14)!
    setRibbonBoundary('id', b1)
    setRibbonBoundary('id', b2)
    expect(getRibbonBoundary('id')).toBe(b2)
  })
})

describe('EdgeLine / PaintedArea boundary fallback logic', () => {
  test('buildEdgeLineFromBoundary returns null for non-positive lineWidth', () => {
    const b = buildRibbonBoundary(STRAIGHT, false, 12)!
    expect(buildEdgeLineFromBoundary(b, 'left', 0)).toBeNull()
    expect(buildEdgeLineFromBoundary(b, 'right', -1)).toBeNull()
  })

  test('getRibbonBoundary missing id returns undefined (cache miss triggers fallback path)', () => {
    expect(getRibbonBoundary('missing-ribbon-id')).toBeUndefined()
  })
})
