import { describe, expect, test } from 'bun:test'
import {
  TRACK_LAYER_ORDER,
  TRACK_LAYER_POLYGON_OFFSETS,
  TRACK_LAYER_Y_OFFSETS,
  type TrackLayerName,
} from './trackLayers'

const LAYERS: TrackLayerName[] = ['GROUND', 'ASPHALT', 'PAINTED_AREA', 'CURB', 'EDGE_LINE']
const LEGACY_FACTORS = [-1, -2, -4] as const

describe('TRACK_LAYER_ORDER', () => {
  test('layers are ordered GROUND < ASPHALT < PAINTED_AREA < CURB < EDGE_LINE', () => {
    expect(TRACK_LAYER_ORDER.GROUND).toBeLessThan(TRACK_LAYER_ORDER.ASPHALT)
    expect(TRACK_LAYER_ORDER.ASPHALT).toBeLessThan(TRACK_LAYER_ORDER.PAINTED_AREA)
    expect(TRACK_LAYER_ORDER.PAINTED_AREA).toBeLessThan(TRACK_LAYER_ORDER.CURB)
    expect(TRACK_LAYER_ORDER.CURB).toBeLessThan(TRACK_LAYER_ORDER.EDGE_LINE)
  })
})

describe('TRACK_LAYER_Y_OFFSETS', () => {
  test('ground sits at 0', () => {
    expect(TRACK_LAYER_Y_OFFSETS.GROUND).toBe(0)
  })

  test('edge line stays above asphalt to avoid z-fighting at glancing angles', () => {
    expect(TRACK_LAYER_Y_OFFSETS.EDGE_LINE).toBeGreaterThan(TRACK_LAYER_Y_OFFSETS.ASPHALT)
  })

  test('legacy asphalt y-offset preserved exactly', () => {
    expect(TRACK_LAYER_Y_OFFSETS.ASPHALT).toBe(0.05)
  })

  test('legacy edge-line y-offset preserved exactly', () => {
    expect(TRACK_LAYER_Y_OFFSETS.EDGE_LINE).toBeCloseTo(0.052, 6)
  })
})

describe('TRACK_LAYER_POLYGON_OFFSETS', () => {
  test('every layer factor matches a legacy value', () => {
    for (const layer of LAYERS) {
      const { factor } = TRACK_LAYER_POLYGON_OFFSETS[layer]
      if (layer === 'GROUND') {
        expect(factor).toBe(0)
      } else {
        expect(LEGACY_FACTORS).toContain(factor as -1 | -2 | -4)
      }
    }
  })

  test('factor equals units for every layer', () => {
    for (const layer of LAYERS) {
      const { factor, units } = TRACK_LAYER_POLYGON_OFFSETS[layer]
      expect(factor).toBe(units)
    }
  })

  test('legacy literals preserved per layer', () => {
    expect(TRACK_LAYER_POLYGON_OFFSETS.ASPHALT.factor).toBe(-1)
    expect(TRACK_LAYER_POLYGON_OFFSETS.PAINTED_AREA.factor).toBe(-2)
    expect(TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE.factor).toBe(-4)
  })
})
