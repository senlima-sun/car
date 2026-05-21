import { describe, expect, test } from 'vitest'
import type { PlacedObject } from './trackObjects'

describe('PlacedObject parent-anchored schema', () => {
  test('accepts the new parent-anchor fields', () => {
    const placed: PlacedObject = {
      id: 'derived-1',
      type: 'edge_line',
      position: [0, 0, 0],
      rotation: 0,
      parentRibbonId: 'ribbon-1',
      parentSide: 'left',
      innerOffset: 0,
      derivedWidth: 0.2,
      tRange: [0.1, 0.9],
      parentClosedOverride: false,
    }

    expect(placed.parentRibbonId).toBe('ribbon-1')
    expect(placed.parentSide).toBe('left')
    expect(placed.derivedWidth).toBe(0.2)
    expect(placed.tRange).toEqual([0.1, 0.9])
  })

  test('round-trips through JSON without losing fields', () => {
    const placed: PlacedObject = {
      id: 'curb-1',
      type: 'curb',
      position: [10, 0, 5],
      rotation: 0,
      parentRibbonId: 'ribbon-main',
      parentSide: 'right',
      innerOffset: 0,
      derivedWidth: 1.5,
      tRange: [0.25, 0.4],
    }
    const roundTripped = JSON.parse(JSON.stringify(placed)) as PlacedObject
    expect(roundTripped).toEqual(placed)
  })

  test('edge_line is a valid ObjectType', () => {
    const placed: PlacedObject = {
      id: 'edge-1',
      type: 'edge_line',
      position: [0, 0, 0],
      rotation: 0,
    }
    expect(placed.type).toBe('edge_line')
  })
})
