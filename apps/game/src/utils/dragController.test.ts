import { describe, expect, test } from 'bun:test'
import {
  applyPointerDelta,
  clampPositionToViewport,
  dragStep,
} from './dragController'

const VP = { width: 1000, height: 800 }
const PANEL = { width: 200, height: 150 }

describe('clampPositionToViewport', () => {
  test('passes through positions fully inside', () => {
    expect(clampPositionToViewport({ x: 100, y: 100 }, VP, PANEL)).toEqual({ x: 100, y: 100 })
  })

  test('clamps right edge', () => {
    expect(clampPositionToViewport({ x: 5000, y: 100 }, VP, PANEL)).toEqual({ x: 800, y: 100 })
  })

  test('clamps bottom edge', () => {
    expect(clampPositionToViewport({ x: 100, y: 5000 }, VP, PANEL)).toEqual({ x: 100, y: 650 })
  })

  test('clamps left edge (negative x)', () => {
    expect(clampPositionToViewport({ x: -100, y: 100 }, VP, PANEL)).toEqual({ x: 0, y: 100 })
  })

  test('clamps top edge (negative y)', () => {
    expect(clampPositionToViewport({ x: 100, y: -100 }, VP, PANEL)).toEqual({ x: 100, y: 0 })
  })

  test('defensive against oversized panel — clamps to 0', () => {
    expect(clampPositionToViewport({ x: 500, y: 500 }, VP, { width: 2000, height: 2000 })).toEqual({
      x: 0,
      y: 0,
    })
  })

  test('defensive against NaN', () => {
    expect(clampPositionToViewport({ x: NaN, y: NaN }, VP, PANEL)).toEqual({ x: 0, y: 0 })
  })

  test('panel exactly at right edge', () => {
    expect(clampPositionToViewport({ x: 800, y: 0 }, VP, PANEL)).toEqual({ x: 800, y: 0 })
  })

  test('panel just past right edge clamps to edge', () => {
    expect(clampPositionToViewport({ x: 801, y: 0 }, VP, PANEL)).toEqual({ x: 800, y: 0 })
  })
})

describe('applyPointerDelta', () => {
  test('moves panel by pointer delta', () => {
    const session = { startPointer: { x: 100, y: 100 }, startPanelPos: { x: 50, y: 50 } }
    expect(applyPointerDelta(session, { x: 130, y: 140 })).toEqual({ x: 80, y: 90 })
  })

  test('zero delta returns original position', () => {
    const session = { startPointer: { x: 100, y: 100 }, startPanelPos: { x: 50, y: 50 } }
    expect(applyPointerDelta(session, { x: 100, y: 100 })).toEqual({ x: 50, y: 50 })
  })

  test('negative delta moves panel up-left', () => {
    const session = { startPointer: { x: 100, y: 100 }, startPanelPos: { x: 50, y: 50 } }
    expect(applyPointerDelta(session, { x: 70, y: 60 })).toEqual({ x: 20, y: 10 })
  })
})

describe('dragStep — composition', () => {
  test('drag inside viewport just applies delta', () => {
    const session = { startPointer: { x: 100, y: 100 }, startPanelPos: { x: 50, y: 50 } }
    expect(dragStep(session, { x: 200, y: 200 }, VP, PANEL)).toEqual({ x: 150, y: 150 })
  })

  test('drag past viewport edge clamps', () => {
    const session = { startPointer: { x: 100, y: 100 }, startPanelPos: { x: 700, y: 100 } }
    expect(dragStep(session, { x: 500, y: 100 }, VP, PANEL)).toEqual({ x: 800, y: 100 })
  })

  test('drag with pointer leaving window (huge negative coords) clamps to 0', () => {
    const session = { startPointer: { x: 100, y: 100 }, startPanelPos: { x: 50, y: 50 } }
    expect(dragStep(session, { x: -9999, y: -9999 }, VP, PANEL)).toEqual({ x: 0, y: 0 })
  })
})
