import { BORDER, FM, FS, LABEL_COL, LW } from '../constants'
import type { CellBounds } from '../helpers'

export function strokeCell(ctx: CanvasRenderingContext2D, b: CellBounds, bg?: string) {
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(b.x, b.y, b.w, b.h)
  }
  ctx.strokeStyle = BORDER
  ctx.lineWidth = LW
  ctx.strokeRect(b.x, b.y, b.w, b.h)
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  b: CellBounds,
  label: string,
  color = LABEL_COL,
) {
  const fs = Math.round(Math.min(b.h * 0.22, 22))
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = `bold ${fs}px ${FS}`
  ctx.fillText(label, b.x + 6, b.y + 4)
}

export function drawValue(
  ctx: CanvasRenderingContext2D,
  b: CellBounds,
  value: string,
  color: string,
  sizeFactor = 0.5,
) {
  const fs = Math.round(Math.min(b.h * sizeFactor, 72))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.font = `bold ${fs}px ${FM}`
  ctx.fillText(value, b.x + b.w / 2, b.y + b.h * 0.58)
}

export function drawSub(
  ctx: CanvasRenderingContext2D,
  b: CellBounds,
  sub: string,
  color = LABEL_COL,
) {
  const fs = Math.round(Math.min(b.h * 0.17, 16))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = color
  ctx.font = `${fs}px ${FS}`
  ctx.fillText(sub, b.x + b.w / 2, b.y + b.h - 3)
}

export function drawCell(
  ctx: CanvasRenderingContext2D,
  b: CellBounds,
  label: string,
  value: string,
  color: string,
  opts?: {
    bg?: string
    sub?: string
    subColor?: string
    labelColor?: string
    sizeFactor?: number
  },
) {
  strokeCell(ctx, b, opts?.bg)
  drawLabel(ctx, b, label, opts?.labelColor)
  drawValue(ctx, b, value, color, opts?.sizeFactor)
  if (opts?.sub) drawSub(ctx, b, opts.sub, opts.subColor)
}
