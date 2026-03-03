import { CH } from '../../../telemetry/channels'
import type { TelemetryRingBuffer } from '../../../telemetry/TelemetryRingBuffer'

const TRACE_SECONDS = 10
const FRAMES_120HZ = TRACE_SECONDS * 120

export function drawSpeedTrace(
  ctx: CanvasRenderingContext2D,
  buffer: TelemetryRingBuffer,
  x: number,
  y: number,
  w: number,
  h: number,
  dpr: number,
) {
  const data = buffer.getChannel(CH.SPEED_KMH, FRAMES_120HZ)
  const n = data.length
  if (n < 2) return

  const sx = x * dpr
  const sy = y * dpr
  const sw = w * dpr
  const sh = h * dpr

  ctx.save()
  ctx.globalAlpha = 0.6
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(sx, sy, sw, sh)
  ctx.globalAlpha = 1

  let maxSpeed = 0
  for (let i = 0; i < n; i++) {
    if (data[i] > maxSpeed) maxSpeed = data[i]
  }
  maxSpeed = Math.max(maxSpeed, 50)
  const ceil = Math.ceil(maxSpeed / 50) * 50

  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = dpr
  for (let v = 50; v < ceil; v += 50) {
    const py = sy + sh - (v / ceil) * sh
    ctx.beginPath()
    ctx.moveTo(sx, py)
    ctx.lineTo(sx + sw, py)
    ctx.stroke()
  }

  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 1.5 * dpr
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const px = sx + (i / (n - 1)) * sw
    const py = sy + sh - (data[i] / ceil) * sh
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()

  const last = data[n - 1]
  ctx.fillStyle = '#ffffff'
  ctx.font = `${11 * dpr}px monospace`
  ctx.textAlign = 'right'
  ctx.fillText(`${Math.round(last)} km/h`, sx + sw - 4 * dpr, sy + 14 * dpr)

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `${9 * dpr}px monospace`
  ctx.textAlign = 'left'
  ctx.fillText('SPEED', sx + 4 * dpr, sy + 12 * dpr)

  ctx.restore()
}
