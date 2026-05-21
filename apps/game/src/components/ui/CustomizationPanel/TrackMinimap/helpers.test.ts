import { describe, expect, it } from 'vitest'
import type { PlacedObject } from '@/types/trackObjects'
import { MINIMAP_SIZE, PADDING } from './constants'
import { computeBounds, makeTransforms } from './helpers'

function makeRoad(
  start: [number, number, number],
  end: [number, number, number],
  controlPoint?: [number, number, number],
): PlacedObject {
  return {
    id: 'r' + Math.random(),
    type: 'road',
    position: start,
    rotation: 0,
    startPoint: start,
    endPoint: end,
    controlPoint,
  } as PlacedObject
}

describe('computeBounds', () => {
  it('returns null for empty input', () => {
    expect(computeBounds([])).toBeNull()
  })

  it('returns null when no road type objects exist', () => {
    const cone: PlacedObject = {
      id: 'c1',
      type: 'cone',
      position: [0, 0, 0],
      rotation: 0,
    } as PlacedObject
    expect(computeBounds([cone])).toBeNull()
  })

  it('computes exact bounds for a single road', () => {
    const road = makeRoad([0, 0, 0], [10, 0, 20])
    const bounds = computeBounds([road])
    expect(bounds).not.toBeNull()
    expect(bounds!.minX).toBe(0)
    expect(bounds!.maxX).toBe(10)
    expect(bounds!.minZ).toBe(0)
    expect(bounds!.maxZ).toBe(20)
    expect(bounds!.rangeX).toBe(10)
    expect(bounds!.rangeZ).toBe(20)
    expect(bounds!.maxRange).toBe(20)
  })

  it('expands bounds to include the curved control point', () => {
    const road = makeRoad([0, 0, 0], [10, 0, 0], [5, 0, 30])
    const bounds = computeBounds([road])!
    expect(bounds.minZ).toBe(0)
    expect(bounds.maxZ).toBe(30)
    expect(bounds.maxRange).toBe(30)
  })

  it('avoids division by zero when range is 0', () => {
    const road = makeRoad([5, 0, 5], [5, 0, 5])
    const bounds = computeBounds([road])!
    expect(bounds.rangeX).toBe(1)
    expect(bounds.rangeZ).toBe(1)
  })
})

describe('makeTransforms', () => {
  const bounds = {
    minX: -50,
    maxX: 50,
    minZ: -50,
    maxZ: 50,
    rangeX: 100,
    rangeZ: 100,
    maxRange: 100,
  }

  it('center of bounds maps to canvas center at angle=0', () => {
    const t = makeTransforms(bounds, 0)
    const cx = t.toScreenX(0)
    const cz = t.toScreenZ(0)
    expect(cx).toBeCloseTo(MINIMAP_SIZE / 2, 6)
    expect(cz).toBeCloseTo(MINIMAP_SIZE / 2, 6)
  })

  it('rotation by 0 is identity', () => {
    const t = makeTransforms(bounds, 0)
    expect(t.rotX(50, 60)).toBeCloseTo(50, 6)
    expect(t.rotZ(50, 60)).toBeCloseTo(60, 6)
  })

  it('rotation by π flips around center', () => {
    const t = makeTransforms(bounds, Math.PI)
    const half = MINIMAP_SIZE / 2
    expect(t.rotX(half + 10, half + 20)).toBeCloseTo(half - 10, 6)
    expect(t.rotZ(half + 10, half + 20)).toBeCloseTo(half - 20, 6)
  })

  it('rotation by π/2 sends (1,0) offset to (0,1) offset', () => {
    const t = makeTransforms(bounds, Math.PI / 2)
    const half = MINIMAP_SIZE / 2
    expect(t.rotX(half + 1, half)).toBeCloseTo(half, 6)
    expect(t.rotZ(half + 1, half)).toBeCloseTo(half + 1, 6)
  })

  it('drawSize equals MINIMAP_SIZE - 2*PADDING', () => {
    const t = makeTransforms(bounds, 0)
    expect(t.drawSize).toBe(MINIMAP_SIZE - PADDING * 2)
  })

  it('scale equals drawSize / maxRange', () => {
    const t = makeTransforms(bounds, 0)
    expect(t.scale).toBeCloseTo((MINIMAP_SIZE - PADDING * 2) / 100, 6)
  })
})
