import { CH } from '../../../telemetry/channels'
import type { TelemetryRingBuffer } from '../../../telemetry/TelemetryRingBuffer'

const MAX_G = 5
const TRAIL_FRAMES = 60

export function drawGForceCircle(
  ctx: CanvasRenderingContext2D,
  buffer: TelemetryRingBuffer,
  x: number,
  y: number,
  size: number,
  dpr: number,
) {
  const sx = x * dpr
  const sy = y * dpr
  const ss = size * dpr
  const cx = sx + ss / 2
  const cy = sy + ss / 2
  const r = ss / 2 - 4 * dpr

  ctx.save()
  ctx.globalAlpha = 0.6
  ctx.fillStyle = '#0a0a0a'
  ctx.beginPath()
  ctx.arc(cx, cy, ss / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = dpr
  for (let g = 1; g <= MAX_G; g++) {
    ctx.beginPath()
    ctx.arc(cx, cy, (g / MAX_G) * r, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.moveTo(cx - r, cy)
  ctx.lineTo(cx + r, cy)
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx, cy + r)
  ctx.stroke()

  const latData = buffer.getChannel(CH.LATERAL_G, TRAIL_FRAMES)
  const lonData = buffer.getChannel(CH.LONGITUDINAL_G, TRAIL_FRAMES)
  const n = Math.min(latData.length, lonData.length)

  if (n > 1) {
    ctx.strokeStyle = 'rgba(0,200,255,0.2)'
    ctx.lineWidth = dpr
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const gx = cx + (latData[i] / MAX_G) * r
      const gy = cy - (lonData[i] / MAX_G) * r
      if (i === 0) ctx.moveTo(gx, gy)
      else ctx.lineTo(gx, gy)
    }
    ctx.stroke()
  }

  if (n >= 1) {
    const curLat = latData[n - 1]
    const curLon = lonData[n - 1]
    const dotX = cx + (curLat / MAX_G) * r
    const dotY = cy - (curLon / MAX_G) * r

    ctx.fillStyle = '#00c8ff'
    ctx.beginPath()
    ctx.arc(dotX, dotY, 4 * dpr, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `${9 * dpr}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText(
      `${curLat.toFixed(1)} / ${curLon.toFixed(1)} G`,
      cx,
      sy + ss - 2 * dpr,
    )
  }

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `${9 * dpr}px monospace`
  ctx.textAlign = 'center'
  ctx.fillText('G-FORCE', cx, sy + 12 * dpr)

  ctx.restore()
}
