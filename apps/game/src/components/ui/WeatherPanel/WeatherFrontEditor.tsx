import { useRef, useState } from 'react'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { useWeatherSourcesStore } from '@/stores/useWeatherSourcesStore'
import { usePhysicsOptional } from '@/wasm/PhysicsProvider'
import { computeBounds, makeTransforms } from '../CustomizationPanel/TrackMinimap/helpers'
import { drawRoads } from '../CustomizationPanel/TrackMinimap/drawing/drawRoads'
import { MINIMAP_SIZE, PADDING } from '../CustomizationPanel/TrackMinimap/constants'
import { pathToSources, type Point2D } from './frontPath'
import { useEffect } from 'react'

const POINT_DISTANCE_THRESHOLD_PX = 3

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

export default function WeatherFrontEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [pathScreen, setPathScreen] = useState<{ x: number; y: number }[]>([])
  const [sourceCount, setSourceCount] = useState(5)
  const [radius, setRadius] = useState(150)
  const [intensity, setIntensity] = useState(1)
  const [velocity, setVelocity] = useState(5)

  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const physics = usePhysicsOptional()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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
      ctx.globalAlpha = 0.4
      drawRoads(ctx, roads, transforms)
      ctx.globalAlpha = 1

      if (pathScreen.length > 1) {
        ctx.strokeStyle = 'rgba(255, 180, 80, 0.9)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(pathScreen[0].x, pathScreen[0].y)
        for (let i = 1; i < pathScreen.length; i++) ctx.lineTo(pathScreen[i].x, pathScreen[i].y)
        ctx.stroke()
      } else if (pathScreen.length === 1) {
        ctx.fillStyle = 'rgba(255, 180, 80, 0.9)'
        ctx.beginPath()
        ctx.arc(pathScreen[0].x, pathScreen[0].y, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.strokeStyle = 'rgba(120, 160, 220, 0.4)'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, MINIMAP_SIZE - 1, MINIMAP_SIZE - 1)
    }

    draw()
  }, [placedObjects, pathScreen])

  const screenToWorld = (sx: number, sy: number): Point2D => {
    const bounds = computeBounds(placedObjects) ?? fallbackBounds()
    const transforms = makeTransforms(bounds, 0)
    const drawSize = MINIMAP_SIZE - PADDING * 2
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerZ = (bounds.minZ + bounds.maxZ) / 2
    const x = (sx - PADDING - drawSize / 2) / transforms.scale + centerX
    const z = (sy - PADDING - drawSize / 2) / transforms.scale + centerZ
    return { x, z }
  }

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDrawing(true)
    setPathScreen([{ x, y }])
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setPathScreen(prev => {
      const last = prev[prev.length - 1]
      if (last) {
        const dx = x - last.x
        const dy = y - last.y
        if (dx * dx + dy * dy < POINT_DISTANCE_THRESHOLD_PX * POINT_DISTANCE_THRESHOLD_PX) {
          return prev
        }
      }
      return [...prev, { x, y }]
    })
  }

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setDrawing(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const apply = () => {
    if (!physics || pathScreen.length < 2) return
    const worldPath = pathScreen.map(p => screenToWorld(p.x, p.y))
    const sources = pathToSources(worldPath, {
      sourceCount,
      radius,
      intensity,
      velocityMagnitude: velocity,
    })
    physics.replaceWeatherSources(sources)
    useWeatherSourcesStore.getState().setSources(sources)
  }

  const clearPath = () => {
    setPathScreen([])
  }

  const clearAll = () => {
    if (!physics) return
    physics.clearWeatherSources()
    useWeatherSourcesStore.getState().clear()
    setPathScreen([])
  }

  return (
    <div style={styles.container}>
      <div style={styles.label}>Weather Front Editor</div>
      <canvas
        ref={canvasRef}
        style={{
          width: MINIMAP_SIZE,
          height: MINIMAP_SIZE,
          display: 'block',
          borderRadius: 4,
          touchAction: 'none',
          cursor: 'crosshair',
        }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
      />
      <div style={styles.row}>
        <span style={styles.small}>sources</span>
        <input
          style={styles.range}
          type='range'
          min={2}
          max={8}
          value={sourceCount}
          onChange={e => setSourceCount(Number(e.target.value))}
        />
        <span style={styles.value}>{sourceCount}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.small}>radius</span>
        <input
          style={styles.range}
          type='range'
          min={50}
          max={500}
          step={10}
          value={radius}
          onChange={e => setRadius(Number(e.target.value))}
        />
        <span style={styles.value}>{radius}m</span>
      </div>
      <div style={styles.row}>
        <span style={styles.small}>intensity</span>
        <input
          style={styles.range}
          type='range'
          min={0}
          max={1}
          step={0.05}
          value={intensity}
          onChange={e => setIntensity(Number(e.target.value))}
        />
        <span style={styles.value}>{intensity.toFixed(2)}</span>
      </div>
      <div style={styles.row}>
        <span style={styles.small}>drift m/s</span>
        <input
          style={styles.range}
          type='range'
          min={0}
          max={20}
          step={0.5}
          value={velocity}
          onChange={e => setVelocity(Number(e.target.value))}
        />
        <span style={styles.value}>{velocity.toFixed(1)}</span>
      </div>
      <div style={styles.buttons}>
        <button style={styles.button} onClick={apply} disabled={pathScreen.length < 2}>
          Apply
        </button>
        <button style={styles.button} onClick={clearPath}>
          Clear path
        </button>
        <button style={styles.button} onClick={clearAll}>
          Clear all
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 6,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#88b0ff',
  },
  row: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  small: { fontSize: 10, color: '#9bb0c8', minWidth: 60 },
  range: { flex: 1 },
  value: { fontSize: 10, color: '#e8f0fa', minWidth: 40, textAlign: 'right' as const },
  buttons: {
    display: 'flex' as const,
    gap: 4,
    marginTop: 4,
  },
  button: {
    flex: 1,
    background: 'rgba(60, 90, 130, 0.5)',
    color: '#e8f0fa',
    border: '1px solid rgba(120, 160, 220, 0.4)',
    borderRadius: 3,
    padding: '4px 6px',
    fontSize: 10,
    fontFamily: 'monospace',
    cursor: 'pointer' as const,
  },
}
