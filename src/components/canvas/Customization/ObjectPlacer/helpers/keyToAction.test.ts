import { describe, expect, it } from 'bun:test'
import type { PlacementState } from '@/types/trackObjects'
import { keyToAction } from './keyToAction'

const baseEvent = {
  code: '',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
}

const ctx = (placementState: PlacementState = 'selecting') => ({ placementState })

describe('keyToAction', () => {
  it('Ctrl+Z returns undo', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyZ', ctrlKey: true }, ctx())).toEqual({
      kind: 'undo',
    })
  })

  it('Ctrl+Shift+Z returns redo', () => {
    expect(
      keyToAction({ ...baseEvent, code: 'KeyZ', ctrlKey: true, shiftKey: true }, ctx()),
    ).toEqual({ kind: 'redo' })
  })

  it('Cmd+Shift+Z returns redo on Mac', () => {
    expect(
      keyToAction({ ...baseEvent, code: 'KeyZ', metaKey: true, shiftKey: true }, ctx()),
    ).toEqual({ kind: 'redo' })
  })

  it('Cmd+Z (metaKey) returns undo on Mac', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyZ', metaKey: true }, ctx())).toEqual({
      kind: 'undo',
    })
  })

  it('Ctrl+C returns copy', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyC', ctrlKey: true }, ctx())).toEqual({
      kind: 'copy',
    })
  })

  it('Ctrl+V returns paste', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyV', ctrlKey: true }, ctx())).toEqual({
      kind: 'paste',
    })
  })

  it('R returns rotate', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyR' }, ctx())).toEqual({ kind: 'rotate' })
  })

  it('Y returns toggleElevation', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyY' }, ctx())).toEqual({ kind: 'toggleElevation' })
  })

  it('Escape returns cancel', () => {
    expect(keyToAction({ ...baseEvent, code: 'Escape' }, ctx())).toEqual({ kind: 'cancel' })
  })

  it('Backspace returns undoPolygonPoint only in polygon mode', () => {
    expect(keyToAction({ ...baseEvent, code: 'Backspace' }, ctx('polygonDrawing'))).toEqual({
      kind: 'undoPolygonPoint',
    })
    expect(keyToAction({ ...baseEvent, code: 'Backspace' }, ctx('selecting'))).toBeNull()
  })

  it('Enter returns closePolygon only in polygon mode', () => {
    expect(keyToAction({ ...baseEvent, code: 'Enter' }, ctx('polygonDrawing'))).toEqual({
      kind: 'closePolygon',
    })
    expect(keyToAction({ ...baseEvent, code: 'Enter' }, ctx('selecting'))).toBeNull()
  })

  it('unrecognized key returns null', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyA' }, ctx())).toBeNull()
    expect(keyToAction({ ...baseEvent, code: 'Tab' }, ctx())).toBeNull()
  })

  it('Ctrl+R is treated as rotate (no special browser-reload override)', () => {
    expect(keyToAction({ ...baseEvent, code: 'KeyR', ctrlKey: true }, ctx())).toEqual({
      kind: 'rotate',
    })
  })
})
