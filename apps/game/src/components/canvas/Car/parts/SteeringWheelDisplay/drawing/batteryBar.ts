import { BAT_H, BORDER, CH, CW, FS, GREEN, LABEL_COL, LW, ORANGE, PAD, RED } from '../constants'

export function drawBatteryBar(ctx: CanvasRenderingContext2D, charge: number) {
  const x = PAD
  const y = CH - PAD - BAT_H
  const w = CW - PAD * 2
  const h = BAT_H

  ctx.strokeStyle = BORDER
  ctx.lineWidth = LW
  ctx.strokeRect(x, y, w, h)

  const segments = 24
  const sp = 3
  const segW = (w - sp * 2) / segments
  const segH = h - sp * 2
  const filled = Math.round((charge / 100) * segments)

  for (let i = 0; i < filled; i++) {
    const ratio = i / segments
    ctx.fillStyle = ratio < 0.25 ? RED : ratio < 0.45 ? ORANGE : GREEN
    ctx.fillRect(x + sp + i * segW + 1, y + sp, segW - 2, segH)
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = LABEL_COL
  ctx.font = `bold ${Math.round(h * 0.5)}px ${FS}`
  ctx.fillText('SOC', x + w - 8, y + h / 2)
}
