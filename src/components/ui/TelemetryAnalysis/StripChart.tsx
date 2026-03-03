import { useRef, useEffect, useCallback, useState } from 'react'
import { TELEMETRY_STRIDE, CH } from '../../../telemetry/channels'
import type { ChannelId } from '../../../telemetry/channels'
import type { TelemetryLap } from '../../../telemetry/TelemetryRingBuffer'
import {
  drawStripChart,
  findFrameAtX,
  type ChartViewport,
  type CursorState,
} from './AnalysisCanvas'

interface StripChartProps {
  lap: TelemetryLap
  comparisonLap: TelemetryLap | null
  channels: ChannelId[]
  width: number
  height: number
}

export default function StripChart({
  lap,
  comparisonLap,
  channels,
  width,
  height,
}: StripChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [xMode, setXMode] = useState<'time' | 'distance'>('distance')
  const viewportRef = useRef<ChartViewport>({ startX: 0, endX: 0, xMode: 'distance' })
  const cursorRef = useRef<CursorState>({ frameIndex: null, x: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef(0)
  const dragViewportStart = useRef(0)

  useEffect(() => {
    const xCh = xMode === 'time' ? CH.TIMESTAMP : CH.DISTANCE
    let maxX = 0
    for (let i = 0; i < lap.frameCount; i++) {
      const v = lap.data[i * TELEMETRY_STRIDE + xCh]
      if (v > maxX) maxX = v
    }
    viewportRef.current = { startX: 0, endX: maxX || 1, xMode }
    redraw()
  }, [lap, xMode, channels])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const cw = width * dpr
    const ch = height * dpr
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }

    drawStripChart(
      ctx,
      lap.data,
      lap.frameCount,
      channels,
      viewportRef.current,
      cursorRef.current,
      comparisonLap?.data ?? null,
      comparisonLap?.frameCount ?? 0,
      0,
      0,
      width,
      height,
      dpr,
    )
  }, [lap, comparisonLap, channels, width, height])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const vp = viewportRef.current
      const range = vp.endX - vp.startX
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const normX = (e.clientX - rect.left) / rect.width
      const center = vp.startX + normX * range

      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
      const newRange = range * factor
      const newStart = center - normX * newRange
      const newEnd = center + (1 - normX) * newRange
      viewportRef.current = { ...vp, startX: Math.max(0, newStart), endX: newEnd }
      redraw()
    },
    [redraw],
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = e.clientX
    dragViewportStart.current = viewportRef.current.startX
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      if (isDragging.current) {
        const dx = e.clientX - dragStart.current
        const range = viewportRef.current.endX - viewportRef.current.startX
        const shift = (-dx / rect.width) * range
        const newStart = dragViewportStart.current + shift
        viewportRef.current = {
          ...viewportRef.current,
          startX: Math.max(0, newStart),
          endX: Math.max(0, newStart) + range,
        }
      } else {
        const normX = (e.clientX - rect.left) / rect.width
        const idx = findFrameAtX(lap.data, lap.frameCount, viewportRef.current, normX)
        cursorRef.current = { frameIndex: idx, x: normX }
      }
      redraw()
    },
    [lap, redraw],
  )

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
    cursorRef.current = { frameIndex: null, x: 0 }
    redraw()
  }, [redraw])

  return (
    <div className='flex flex-col gap-1'>
      <div className='flex gap-2 items-center px-2'>
        <button
          onClick={() => setXMode('time')}
          className={`text-xs px-2 py-0.5 rounded ${
            xMode === 'time' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'
          }`}
        >
          Time
        </button>
        <button
          onClick={() => setXMode('distance')}
          className={`text-xs px-2 py-0.5 rounded ${
            xMode === 'distance' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'
          }`}
        >
          Distance
        </button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: 'crosshair' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
}
