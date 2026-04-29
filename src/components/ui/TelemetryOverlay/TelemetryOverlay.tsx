import { useRef, useEffect } from 'react'
import { useTelemetryStore } from '../../../stores/useTelemetryStore'
import { drawSpeedTrace } from './SpeedTrace'
import { drawInputBars } from './InputBars'
import { drawGForceCircle } from './GForceCircle'
import { CH } from '../../../telemetry/channels'

const CANVAS_W = 420
const CANVAS_H = 200
const UPDATE_INTERVAL = 1000 / 30

export default function TelemetryOverlay() {
  const isVisible = useTelemetryStore(s => s.isOverlayVisible)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const lastDrawRef = useRef(0)

  useEffect(() => {
    if (!isVisible) return

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw)

      if (now - lastDrawRef.current < UPDATE_INTERVAL) return
      lastDrawRef.current = now

      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const bufRef = useTelemetryStore.getState().bufferRef
      if (!bufRef) return
      const buffer = bufRef.current

      const dpr = window.devicePixelRatio || 1
      const cw = CANVAS_W * dpr
      const ch = CANVAS_H * dpr

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }

      ctx.clearRect(0, 0, cw, ch)

      drawSpeedTrace(ctx, buffer, 0, 0, 260, 90, dpr)
      drawInputBars(ctx, buffer, 268, 0, 40, 90, dpr)
      drawGForceCircle(ctx, buffer, 316, 0, 100, dpr)

      if (buffer.getFrameCount() > 0) {
        drawMiniData(ctx, buffer, dpr)
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: CANVAS_W,
        height: CANVAS_H,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  )
}

function drawMiniData(
  ctx: CanvasRenderingContext2D,
  buffer: import('../../../telemetry/TelemetryRingBuffer').TelemetryRingBuffer,
  dpr: number,
) {
  const y = 98
  const x = 0
  const w = CANVAS_W
  const h = CANVAS_H - y

  const sx = x * dpr
  const sy = y * dpr
  const sw = w * dpr
  const sh = h * dpr

  ctx.save()
  ctx.globalAlpha = 0.6
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(sx, sy, sw, sh)
  ctx.globalAlpha = 1

  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = `${9 * dpr}px monospace`

  const ersData = buffer.getChannel(CH.ERS_BATTERY, 1)
  const brakeTemps = [
    buffer.getChannel(CH.BRAKE_TEMP_FL, 1),
    buffer.getChannel(CH.BRAKE_TEMP_FR, 1),
    buffer.getChannel(CH.BRAKE_TEMP_RL, 1),
    buffer.getChannel(CH.BRAKE_TEMP_RR, 1),
  ]
  const tireTemps = [
    buffer.getChannel(CH.TIRE_TEMP_FL, 1),
    buffer.getChannel(CH.TIRE_TEMP_FR, 1),
    buffer.getChannel(CH.TIRE_TEMP_RL, 1),
    buffer.getChannel(CH.TIRE_TEMP_RR, 1),
  ]
  const engineTemp = buffer.getChannel(CH.ENGINE_TEMP, 1)
  const brakeFade = buffer.getChannel(CH.BRAKE_FADE, 1)

  const col1 = sx + 8 * dpr
  const col2 = sx + 150 * dpr
  const col3 = sx + 290 * dpr
  const lineH = 14 * dpr
  let row = sy + 16 * dpr

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'

  ctx.fillText('ERS', col1, row)
  ctx.fillStyle = getErsColor(last(ersData))
  ctx.fillText(`${Math.round(last(ersData))}%`, col1 + 30 * dpr, row)

  ctx.fillStyle = '#ffffff'
  ctx.fillText('ENG', col2, row)
  const engC = last(engineTemp) * 140 + 20
  ctx.fillStyle = getHeatColor(engC, 90, 125)
  ctx.fillText(`${Math.round(engC)}°C`, col2 + 30 * dpr, row)

  ctx.fillStyle = '#ffffff'
  ctx.fillText('FADE', col3, row)
  const fadeVal = last(brakeFade)
  ctx.fillStyle = fadeVal < 0.85 ? '#ef4444' : fadeVal < 0.95 ? '#eab308' : '#22c55e'
  ctx.fillText(`${(fadeVal * 100).toFixed(0)}%`, col3 + 40 * dpr, row)

  row += lineH + 4 * dpr
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillText('BRAKE °C', col1, row)
  ctx.fillText('TIRE TEMP', col2, row)

  row += lineH
  const labels = ['FL', 'FR', 'RL', 'RR']
  for (let i = 0; i < 4; i++) {
    const bx = (i < 2 ? col1 : col1 + 80 * dpr) + (i % 2 === 0 ? 0 : 40 * dpr)
    const by = row + (i < 2 ? 0 : lineH)
    const bTemp = last(brakeTemps[i])
    ctx.fillStyle = getHeatColor(bTemp, 400, 800)
    ctx.fillText(`${labels[i]} ${Math.round(bTemp)}`, bx, by)
  }

  for (let i = 0; i < 4; i++) {
    const tx = (i < 2 ? col2 : col2 + 80 * dpr) + (i % 2 === 0 ? 0 : 40 * dpr)
    const ty = row + (i < 2 ? 0 : lineH)
    const tTemp = last(tireTemps[i])
    const tCelsius = tTemp * 160 + 20
    ctx.fillStyle = getTireColor(tTemp)
    ctx.fillText(`${labels[i]} ${Math.round(tCelsius)}`, tx, ty)
  }

  ctx.restore()
}

function last(arr: Float32Array): number {
  return arr.length > 0 ? arr[arr.length - 1] : 0
}

function getErsColor(pct: number): string {
  if (pct > 60) return '#22c55e'
  if (pct > 30) return '#eab308'
  return '#ef4444'
}

function getHeatColor(temp: number, low: number, high: number): string {
  if (temp < low) return '#3b82f6'
  if (temp < (low + high) / 2) return '#22c55e'
  if (temp < high) return '#eab308'
  return '#ef4444'
}

function getTireColor(normalized: number): string {
  if (normalized < 0.313) return '#3b82f6'
  if (normalized < 0.594) return '#22c55e'
  if (normalized < 0.75) return '#eab308'
  return '#ef4444'
}
