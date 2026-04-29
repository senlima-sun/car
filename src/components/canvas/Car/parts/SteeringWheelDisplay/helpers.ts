import {
  BLUE,
  COLS,
  GREEN,
  GRID_H,
  GRID_W,
  GRID_X,
  GRID_Y,
  ORANGE,
  RED,
  ROW_WEIGHTS,
  TOTAL_RW,
  YELLOW,
} from './constants'

export interface CellBounds {
  x: number
  y: number
  w: number
  h: number
}

export function colX(c: number): number {
  return GRID_X + (c / COLS) * GRID_W
}

export function colW(span: number): number {
  return (span / COLS) * GRID_W
}

export function rowY(r: number): number {
  let sum = 0
  for (let i = 0; i < r; i++) sum += ROW_WEIGHTS[i]
  return GRID_Y + (sum / TOTAL_RW) * GRID_H
}

export function rowH(r: number, span: number): number {
  let sum = 0
  for (let i = r; i < r + span; i++) sum += ROW_WEIGHTS[i]
  return (sum / TOTAL_RW) * GRID_H
}

export function cellBounds(col: number, row: number, cSpan = 1, rSpan = 1): CellBounds {
  return { x: colX(col), y: rowY(row), w: colW(cSpan), h: rowH(row, rSpan) }
}

export function tempToC(n: number): number {
  return Math.round(20 + n * 130)
}

export function tireTempCol(n: number): string {
  if (n < 0.3) return BLUE
  if (n < 0.55) return GREEN
  if (n < 0.75) return YELLOW
  if (n < 0.9) return ORANGE
  return RED
}

export function wearCol(w: number): string {
  return w >= 90 ? RED : w >= 70 ? YELLOW : GREEN
}
