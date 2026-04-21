import { TELEMETRY_STRIDE, CH, CHANNEL_META } from '../../../telemetry/channels'
import type { ChannelId } from '../../../telemetry/channels'

export interface ChartViewport {
  startX: number
  endX: number
  xMode: 'time' | 'distance'
}

export interface CursorState {
  frameIndex: number | null
  x: number
}

const COLORS = [
  '#00ff88',
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#ec4899',
]

export function drawStripChart(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  frameCount: number,
  channels: ChannelId[],
  viewport: ChartViewport,
  cursor: CursorState,
  comparisonData: Float32Array | null,
  comparisonFrameCount: number,
  chartX: number,
  chartY: number,
  chartW: number,
  chartH: number,
  dpr: number,
) {
  const sx = chartX * dpr
  const sy = chartY * dpr
  const sw = chartW * dpr
  const sh = chartH * dpr
  const rowH = sh / channels.length

  const xCh = viewport.xMode === 'time' ? CH.TIMESTAMP : CH.DISTANCE

  ctx.save()
  ctx.clearRect(sx, sy, sw, sh)
  ctx.fillStyle = '#111111'
  ctx.fillRect(sx, sy, sw, sh)

  for (let ci = 0; ci < channels.length; ci++) {
    const ch = channels[ci]
    const meta = CHANNEL_META[ch]
    const ry = sy + ci * rowH
    const rh = rowH

    if (ci > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = dpr
      ctx.beginPath()
      ctx.moveTo(sx, ry)
      ctx.lineTo(sx + sw, ry)
      ctx.stroke()
    }

    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = `${10 * dpr}px monospace`
    ctx.textAlign = 'left'
    ctx.fillText(`${meta.name} (${meta.unit})`, sx + 4 * dpr, ry + 12 * dpr)

    drawChannelLine(
      ctx,
      data,
      frameCount,
      ch,
      xCh,
      viewport,
      sx,
      ry + 16 * dpr,
      sw,
      rh - 20 * dpr,
      dpr,
      COLORS[ci % COLORS.length],
    )

    if (comparisonData && comparisonFrameCount > 0) {
      drawChannelLine(
        ctx,
        comparisonData,
        comparisonFrameCount,
        ch,
        xCh,
        viewport,
        sx,
        ry + 16 * dpr,
        sw,
        rh - 20 * dpr,
        dpr,
        COLORS[ci % COLORS.length] + '66',
      )
    }
  }

  if (cursor.frameIndex != null && cursor.frameIndex >= 0 && cursor.frameIndex < frameCount) {
    const xVal = data[cursor.frameIndex * TELEMETRY_STRIDE + xCh]
    const px = sx + ((xVal - viewport.startX) / (viewport.endX - viewport.startX)) * sw

    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = dpr
    ctx.setLineDash([4 * dpr, 4 * dpr])
    ctx.beginPath()
    ctx.moveTo(px, sy)
    ctx.lineTo(px, sy + sh)
    ctx.stroke()
    ctx.setLineDash([])

    for (let ci = 0; ci < channels.length; ci++) {
      const ch = channels[ci]
      const meta = CHANNEL_META[ch]
      const val = data[cursor.frameIndex * TELEMETRY_STRIDE + ch]
      const ry = sy + ci * rowH

      ctx.fillStyle = '#ffffff'
      ctx.font = `${10 * dpr}px monospace`
      ctx.textAlign = 'right'
      ctx.fillText(
        `${val.toFixed(meta.unit === 'rpm' || meta.unit === 'N' ? 0 : 2)} ${meta.unit}`,
        sx + sw - 4 * dpr,
        ry + 12 * dpr,
      )
    }
  }

  ctx.restore()
}

function drawChannelLine(
  ctx: CanvasRenderingContext2D,
  data: Float32Array,
  frameCount: number,
  ch: ChannelId,
  xCh: number,
  viewport: ChartViewport,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dpr: number,
  color: string,
) {
  const meta = CHANNEL_META[ch]
  const range = viewport.endX - viewport.startX
  if (range <= 0) return

  ctx.strokeStyle = color
  ctx.lineWidth = 1.5 * dpr
  ctx.beginPath()

  let started = false
  const step = Math.max(1, Math.floor(frameCount / (sw / dpr)))

  for (let i = 0; i < frameCount; i += step) {
    const offset = i * TELEMETRY_STRIDE
    const xVal = data[offset + xCh]
    if (xVal < viewport.startX || xVal > viewport.endX) continue

    const px = sx + ((xVal - viewport.startX) / range) * sw
    const val = data[offset + ch]
    const norm = (val - meta.min) / (meta.max - meta.min)
    const py = sy + sh - norm * sh

    if (!started) {
      ctx.moveTo(px, py)
      started = true
    } else {
      ctx.lineTo(px, py)
    }
  }

  ctx.stroke()
}

export function findFrameAtX(
  data: Float32Array,
  frameCount: number,
  viewport: ChartViewport,
  normalizedX: number,
): number {
  const xCh = viewport.xMode === 'time' ? CH.TIMESTAMP : CH.DISTANCE
  const targetX = viewport.startX + normalizedX * (viewport.endX - viewport.startX)

  let closest = 0
  let closestDist = Infinity
  const step = Math.max(1, Math.floor(frameCount / 2000))

  for (let i = 0; i < frameCount; i += step) {
    const val = data[i * TELEMETRY_STRIDE + xCh]
    const dist = Math.abs(val - targetX)
    if (dist < closestDist) {
      closestDist = dist
      closest = i
    }
  }

  return closest
}
