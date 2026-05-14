import { useEffect, useRef } from 'react'
import { useWeatherSourcesStore } from '@/stores/useWeatherSourcesStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { computeBounds, makeTransforms } from '../CustomizationPanel/TrackMinimap/helpers'
import { drawRoads } from '../CustomizationPanel/TrackMinimap/drawing/drawRoads'
import { MINIMAP_SIZE } from '../CustomizationPanel/TrackMinimap/constants'

const REFRESH_INTERVAL_MS = 100
const WORLD_FALLBACK_RANGE = 1000

interface BoundsLike {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  rangeX: number
  rangeZ: number
  maxRange: number
}

function fallbackBounds(): BoundsLike {
  const half = WORLD_FALLBACK_RANGE
  return {
    minX: -half,
    maxX: half,
    minZ: -half,
    maxZ: half,
    rangeX: half * 2,
    rangeZ: half * 2,
    maxRange: half * 2,
  }
}

export default function RadarMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== MINIMAP_SIZE * dpr) canvas.width = MINIMAP_SIZE * dpr
      if (canvas.height !== MINIMAP_SIZE * dpr) canvas.height = MINIMAP_SIZE * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
      ctx.fillStyle = 'rgba(5, 12, 22, 0.9)'
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

      const bounds = computeBounds(placedObjects) ?? fallbackBounds()
      const transforms = makeTransforms(bounds, 0)

      const roads = placedObjects.filter(
        o =>
          (o.type === 'road' && o.startPoint && o.endPoint) ||
          (o.type === 'track_ribbon' && o.ribbonPoints && o.ribbonPoints.length > 1),
      )
      ctx.globalAlpha = 0.5
      drawRoads(ctx, roads, transforms)
      ctx.globalAlpha = 1

      const sources = useWeatherSourcesStore.getState().sources
      for (const s of sources) {
        const sx = transforms.rotX(transforms.toScreenX(s.x), transforms.toScreenZ(s.z))
        const sz = transforms.rotZ(transforms.toScreenX(s.x), transforms.toScreenZ(s.z))
        const radiusPx = Math.max(4, s.radius * transforms.scale)
        const intensity = Math.max(0, Math.min(1, s.intensity))

        const grad = ctx.createRadialGradient(sx, sz, 0, sx, sz, radiusPx)
        grad.addColorStop(0, `rgba(120, 200, 255, ${0.55 * intensity})`)
        grad.addColorStop(0.6, `rgba(80, 150, 220, ${0.25 * intensity})`)
        grad.addColorStop(1, 'rgba(40, 90, 160, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(sx, sz, radiusPx, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = `rgba(180, 220, 255, ${0.6 * intensity})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(sx, sz, Math.max(2, radiusPx * 0.15), 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(120, 160, 220, 0.4)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, MINIMAP_SIZE - 1, MINIMAP_SIZE - 1)
    }

    draw()
    const id = window.setInterval(draw, REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [placedObjects])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE, display: 'block', borderRadius: 4 }}
    />
  )
}
