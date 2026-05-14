import { CH } from '../../../telemetry/channels'
import type { TelemetryRingBuffer } from '../../../telemetry/TelemetryRingBuffer'

export function drawInputBars(
  ctx: CanvasRenderingContext2D,
  buffer: TelemetryRingBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  dpr: number,
) {
  if (buffer.getFrameCount() < 1) return

  const throttle = buffer.getChannel(CH.THROTTLE, 1)
  const brake = buffer.getChannel(CH.BRAKE, 1)
  const tVal = throttle[throttle.length - 1] ?? 0
  const bVal = brake[brake.length - 1] ?? 0

  const sx = x * dpr
  const sy = y * dpr
  const sw = w * dpr
  const sh = h * dpr

  ctx.save()
  ctx.globalAlpha = 0.6
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(sx, sy, sw, sh)
  ctx.globalAlpha = 1

  const barW = sw * 0.35
  const gap = sw * 0.1
  const barH = sh - 20 * dpr
  const baseY = sy + sh - 6 * dpr

  const tx = sx + gap
  const bx = sx + gap + barW + gap

  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(tx, baseY - barH, barW, barH)
  ctx.fillRect(bx, baseY - barH, barW, barH)

  const tH = tVal * barH
  ctx.fillStyle = '#22c55e'
  ctx.fillRect(tx, baseY - tH, barW, tH)

  const bH = bVal * barH
  ctx.fillStyle = '#ef4444'
  ctx.fillRect(bx, baseY - bH, barW, bH)

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `${9 * dpr}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText('T', tx + barW / 2, sy + 12 * dpr)
  ctx.fillText('B', bx + barW / 2, sy + 12 * dpr)

  ctx.restore()
}
