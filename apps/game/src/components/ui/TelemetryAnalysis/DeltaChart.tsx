import { useRef, useEffect } from 'react'
import type { LapDelta } from '../../../telemetry/lapComparison'

interface DeltaChartProps {
  delta: LapDelta
  width: number
  height: number
}

export default function DeltaChart({ delta, width, height }: DeltaChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cw = width * dpr
    const ch = height * dpr
    canvas.width = cw
    canvas.height = ch

    const n = delta.frameCount
    if (n < 2) return

    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, cw, ch)

    let maxAbs = 0
    for (let i = 0; i < n; i++) {
      const abs = Math.abs(delta.timeDelta[i])
      if (abs > maxAbs) maxAbs = abs
    }
    maxAbs = Math.max(maxAbs, 500)
    const range = Math.ceil(maxAbs / 500) * 500

    const midY = ch / 2

    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = dpr
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(cw, midY)
    ctx.stroke()

    for (let v = 500; v < range; v += 500) {
      const py = midY - (v / range) * (ch / 2)
      const ny = midY + (v / range) * (ch / 2)
      ctx.beginPath()
      ctx.moveTo(0, py)
      ctx.lineTo(cw, py)
      ctx.moveTo(0, ny)
      ctx.lineTo(cw, ny)
      ctx.stroke()
    }

    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const px = (i / (n - 1)) * cw
      const val = delta.timeDelta[i]
      const py = midY - (val / range) * (ch / 2)

      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }

    ctx.strokeStyle = '#00ff88'
    ctx.lineWidth = 2 * dpr
    ctx.stroke()

    for (let i = 1; i < n; i++) {
      const px = (i / (n - 1)) * cw
      const prevPx = ((i - 1) / (n - 1)) * cw
      const val = delta.timeDelta[i]
      const prevVal = delta.timeDelta[i - 1]
      const py = midY - (val / range) * (ch / 2)
      const prevPy = midY - (prevVal / range) * (ch / 2)

      const color = val < 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(prevPx, midY)
      ctx.lineTo(prevPx, prevPy)
      ctx.lineTo(px, py)
      ctx.lineTo(px, midY)
      ctx.closePath()
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `${10 * dpr}px monospace`
    ctx.textAlign = 'left'
    ctx.fillText('DELTA (ms)', 4 * dpr, 14 * dpr)

    const lastDelta = delta.timeDelta[n - 1]
    const sign = lastDelta >= 0 ? '+' : ''
    ctx.fillStyle = lastDelta < 0 ? '#22c55e' : '#ef4444'
    ctx.font = `${14 * dpr}px monospace`
    ctx.textAlign = 'right'
    ctx.fillText(`${sign}${(lastDelta / 1000).toFixed(3)}s`, cw - 4 * dpr, 18 * dpr)

    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = `${9 * dpr}px monospace`
    ctx.textAlign = 'left'
    ctx.fillText('Faster ↑', 4 * dpr, midY - 8 * dpr)
    ctx.fillText('Slower ↓', 4 * dpr, midY + 16 * dpr)
  }, [delta, width, height])

  return <canvas ref={canvasRef} style={{ width, height }} />
}
