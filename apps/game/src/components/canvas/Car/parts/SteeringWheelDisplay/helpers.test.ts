import { describe, expect, it } from 'bun:test'
import { BLUE, GREEN, GRID_H, GRID_W, GRID_X, GRID_Y, ORANGE, RED, YELLOW } from './constants'
import { cellBounds, colW, colX, rowH, rowY, tempToC, tireTempCol, wearCol } from './helpers'

describe('colX / colW', () => {
  it('column 0 starts at GRID_X', () => {
    expect(colX(0)).toBe(GRID_X)
  })

  it('right edge of last column equals GRID_X + GRID_W', () => {
    expect(colX(6)).toBeCloseTo(GRID_X + GRID_W, 6)
  })

  it('sum of all column widths equals GRID_W', () => {
    let total = 0
    for (let i = 0; i < 6; i++) total += colW(1)
    expect(total).toBeCloseTo(GRID_W, 6)
  })
})

describe('rowY / rowH', () => {
  it('row 0 starts at GRID_Y', () => {
    expect(rowY(0)).toBe(GRID_Y)
  })

  it('rowY(5) plus rowH(5,0) equals GRID_Y + GRID_H', () => {
    const lastRowEnd = rowY(4) + rowH(4, 1)
    expect(lastRowEnd).toBeCloseTo(GRID_Y + GRID_H, 6)
  })

  it('rowH spans correctly across multiple rows', () => {
    const span = rowH(0, 5)
    expect(span).toBeCloseTo(GRID_H, 6)
  })
})

describe('cellBounds', () => {
  it('composes colX/rowY/colW/rowH', () => {
    const b = cellBounds(2, 1, 2, 1)
    expect(b.x).toBe(colX(2))
    expect(b.y).toBe(rowY(1))
    expect(b.w).toBe(colW(2))
    expect(b.h).toBe(rowH(1, 1))
  })

  it('default cSpan and rSpan are 1', () => {
    const b = cellBounds(0, 0)
    expect(b.w).toBe(colW(1))
    expect(b.h).toBe(rowH(0, 1))
  })
})

describe('tempToC', () => {
  it('maps 0 to 20', () => {
    expect(tempToC(0)).toBe(20)
  })

  it('maps 1 to 150', () => {
    expect(tempToC(1)).toBe(150)
  })

  it('maps 0.5 to 85', () => {
    expect(tempToC(0.5)).toBe(85)
  })
})

describe('tireTempCol', () => {
  it('cold (< 0.3) returns BLUE', () => {
    expect(tireTempCol(0.0)).toBe(BLUE)
    expect(tireTempCol(0.29)).toBe(BLUE)
  })

  it('cool (0.3 to < 0.55) returns GREEN', () => {
    expect(tireTempCol(0.3)).toBe(GREEN)
    expect(tireTempCol(0.54)).toBe(GREEN)
  })

  it('optimal (0.55 to < 0.75) returns YELLOW', () => {
    expect(tireTempCol(0.55)).toBe(YELLOW)
    expect(tireTempCol(0.74)).toBe(YELLOW)
  })

  it('hot (0.75 to < 0.9) returns ORANGE', () => {
    expect(tireTempCol(0.75)).toBe(ORANGE)
    expect(tireTempCol(0.89)).toBe(ORANGE)
  })

  it('critical (>= 0.9) returns RED', () => {
    expect(tireTempCol(0.9)).toBe(RED)
    expect(tireTempCol(1.0)).toBe(RED)
  })
})

describe('wearCol', () => {
  it('< 70% wear returns GREEN', () => {
    expect(wearCol(0)).toBe(GREEN)
    expect(wearCol(69.9)).toBe(GREEN)
  })

  it('70% to < 90% wear returns YELLOW', () => {
    expect(wearCol(70)).toBe(YELLOW)
    expect(wearCol(89.9)).toBe(YELLOW)
  })

  it('>= 90% wear returns RED', () => {
    expect(wearCol(90)).toBe(RED)
    expect(wearCol(100)).toBe(RED)
  })
})
