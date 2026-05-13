import { describe, expect, test } from 'bun:test'
import {
  buildAsphaltGeometry,
  buildEdgeLineGeometry,
  buildPitLaneGeometry,
  buildRibbonLayers,
  computeRibbonFrames,
} from './ribbonGeometry'
import type { TrackRibbonPoint } from '../../../../types/trackObjects'

const STRAIGHT: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 0, isPitLane: false },
]

const PIT_MIXED: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: true },
  { x: 10, y: 0, z: 0, isPitLane: true },
  { x: 20, y: 0, z: 0, isPitLane: false },
  { x: 30, y: 0, z: 0, isPitLane: false },
]

const CLOSED_LOOP: TrackRibbonPoint[] = [
  { x: 0, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 0, isPitLane: false },
  { x: 10, y: 0, z: 10, isPitLane: false },
  { x: 0, y: 0, z: 10, isPitLane: false },
]

function arraysCloseEnough(a: ArrayLike<number>, b: ArrayLike<number>, tol = 1e-6) {
  expect(a.length).toBe(b.length)
  for (let i = 0; i < a.length; i++) {
    expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(tol)
  }
}

describe('computeRibbonFrames', () => {
  test('returns null for fewer than 2 points', () => {
    expect(computeRibbonFrames([{ x: 0, y: 0, z: 0, isPitLane: false }], false, 12)).toBeNull()
  })

  test('produces left/right offsets perpendicular to tangent', () => {
    const frames = computeRibbonFrames(STRAIGHT, false, 12)!
    expect(frames.leftPositions[0]!.z).toBeCloseTo(6)
    expect(frames.rightPositions[0]!.z).toBeCloseTo(-6)
    expect(frames.leftPositions[0]!.y).toBeCloseTo(0.05)
  })
})

describe('buildAsphaltGeometry', () => {
  test('top-face triangles wind upward', () => {
    const result = buildAsphaltGeometry(STRAIGHT, false, 12)!
    const indices = result.mainIndices
    const positions = result.positions
    const i0 = indices[0]!
    const i1 = indices[1]!
    const i2 = indices[2]!
    const ax = positions[i0 * 3]!
    const az = positions[i0 * 3 + 2]!
    const bx = positions[i1 * 3]! - ax
    const bz = positions[i1 * 3 + 2]! - az
    const cx = positions[i2 * 3]! - ax
    const cz = positions[i2 * 3 + 2]! - az
    const normalY = bz * cx - bx * cz
    expect(normalY).toBeGreaterThan(0)
  })

  test('positions match legacy formula element-wise', () => {
    const result = buildAsphaltGeometry(STRAIGHT, false, 12)!
    expect(result.positions).toEqual(
      new Float32Array([0, 0.05, 6, 0, 0.05, -6, 10, 0.05, 6, 10, 0.05, -6]),
    )
  })

  test('returns null for fewer than 2 points', () => {
    expect(buildAsphaltGeometry([{ x: 0, y: 0, z: 0, isPitLane: false }], false, 12)).toBeNull()
  })
})

describe('buildPitLaneGeometry', () => {
  test('returns null when no pit segment', () => {
    const result = buildPitLaneGeometry(STRAIGHT, false, 12)
    expect(result).toBeNull()
  })

  test('produces geometry containing only pit-flagged segments', () => {
    const asphalt = buildAsphaltGeometry(PIT_MIXED, false, 12)!
    const pit = buildPitLaneGeometry(PIT_MIXED, false, 12, {
      positions: asphalt.positions,
      uvs: asphalt.uvs,
      normals: asphalt.normals,
      pitIndices: asphalt.pitIndices,
    })!
    expect(pit.indices.length).toBe(6)
    expect(pit.indices).toEqual([0, 2, 1, 2, 3, 1])
  })
})

describe('buildEdgeLineGeometry', () => {
  test('left edge places white line inside road surface', () => {
    const frames = computeRibbonFrames(STRAIGHT, false, 12)!
    const left = buildEdgeLineGeometry(frames, 'left', false)
    const pos = left.getAttribute('position')
    expect(pos.getZ(0)).toBeCloseTo(6)
    expect(pos.getZ(1)).toBeCloseTo(6 - 0.2)
  })

  test('right edge places white line inside road surface', () => {
    const frames = computeRibbonFrames(STRAIGHT, false, 12)!
    const right = buildEdgeLineGeometry(frames, 'right', false)
    const pos = right.getAttribute('position')
    expect(pos.getZ(0)).toBeCloseTo(-6)
    expect(pos.getZ(1)).toBeCloseTo(-6 + 0.2)
  })

  test('edge line sits 0.002 above asphalt y', () => {
    const frames = computeRibbonFrames(STRAIGHT, false, 12)!
    const left = buildEdgeLineGeometry(frames, 'left', false)
    const pos = left.getAttribute('position')
    expect(pos.getY(0)).toBeCloseTo(0.052, 6)
  })
})

describe('buildRibbonLayers', () => {
  test('returns the expected runtime fields (no edge geometry; edge_line is its own PlacedObject)', () => {
    const layers = buildRibbonLayers(STRAIGHT, false, 12)!
    expect(layers.mainGeometry).toBeDefined()
    expect(layers.pitGeometry).toBeNull()
    expect(layers.collisionVertices.length).toBe(12)
    expect(layers.collisionIndices.length).toBe(6)
    expect(layers.mainSensorVertices.length).toBe(12)
    expect(layers.mainSensorIndices.length).toBe(6)
    expect(layers.pitSensorVertices).toBeNull()
    expect(layers.pitSensorIndices).toBeNull()
  })

  test('produces pit geometry when input has pit segments', () => {
    const layers = buildRibbonLayers(PIT_MIXED, false, 12)!
    expect(layers.pitGeometry).not.toBeNull()
    expect(layers.pitSensorVertices).not.toBeNull()
    expect(layers.pitSensorIndices!.length).toBe(6)
  })

  test('closed loop produces n segments instead of n-1', () => {
    const closed = buildRibbonLayers(CLOSED_LOOP, true, 12)!
    const open = buildRibbonLayers(CLOSED_LOOP, false, 12)!
    expect(closed.mainSensorIndices.length).toBeGreaterThan(open.mainSensorIndices.length)
  })

  test('collision vertices equal main positions', () => {
    const layers = buildRibbonLayers(STRAIGHT, false, 12)!
    arraysCloseEnough(layers.collisionVertices, layers.mainSensorVertices)
  })
})
