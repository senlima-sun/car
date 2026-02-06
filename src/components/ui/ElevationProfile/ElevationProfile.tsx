import { useEffect, useRef, useMemo, useState } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import type { PlacedObject } from '../../../types/trackObjects'

const CANVAS_WIDTH = 400
const CANVAS_HEIGHT = 120
const PADDING = { top: 15, right: 15, bottom: 25, left: 35 }

function buildElevationProfile(placedObjects: PlacedObject[]): { distance: number; elevation: number; roadId: string }[] {
  const roads = placedObjects.filter(o => o.type === 'road' && o.startPoint && o.endPoint)
  if (roads.length === 0) return []

  const startFinish = placedObjects.find(o => o.type === 'checkpoint' && (o.checkpointType ?? 'start-finish') === 'start-finish')

  const SNAP = 2
  const visited = new Set<string>()
  const profile: { distance: number; elevation: number; roadId: string }[] = []

  let startRoad = roads[0]
  if (startFinish && startFinish.position) {
    let bestDist = Infinity
    for (const r of roads) {
      if (!r.startPoint) continue
      const dx = r.startPoint[0] - startFinish.position[0]
      const dz = r.startPoint[2] - startFinish.position[2]
      const d = Math.sqrt(dx * dx + dz * dz)
      if (d < bestDist) {
        bestDist = d
        startRoad = r
      }
    }
  }

  let currentRoad: PlacedObject | null = startRoad
  let currentEndpoint: 'start' | 'end' = 'start'
  let cumulativeDistance = 0

  while (currentRoad && !visited.has(currentRoad.id)) {
    visited.add(currentRoad.id)

    const startElev = currentEndpoint === 'start'
      ? (currentRoad.startElevation ?? 0)
      : (currentRoad.endElevation ?? 0)
    const endElev = currentEndpoint === 'start'
      ? (currentRoad.endElevation ?? 0)
      : (currentRoad.startElevation ?? 0)

    let length: number
    if (currentRoad.trackMode === 'curve' && currentRoad.controlPoint && currentRoad.startPoint && currentRoad.endPoint) {
      let arcLen = 0
      let px = currentRoad.startPoint[0], pz = currentRoad.startPoint[2]
      for (let i = 1; i <= 20; i++) {
        const t = i / 20
        const t1 = 1 - t
        const x = t1 * t1 * currentRoad.startPoint[0] + 2 * t1 * t * currentRoad.controlPoint[0] + t * t * currentRoad.endPoint[0]
        const z = t1 * t1 * currentRoad.startPoint[2] + 2 * t1 * t * currentRoad.controlPoint[2] + t * t * currentRoad.endPoint[2]
        arcLen += Math.sqrt((x - px) ** 2 + (z - pz) ** 2)
        px = x; pz = z
      }
      length = arcLen
    } else if (currentRoad.startPoint && currentRoad.endPoint) {
      const dx = currentRoad.endPoint[0] - currentRoad.startPoint[0]
      const dz = currentRoad.endPoint[2] - currentRoad.startPoint[2]
      length = Math.sqrt(dx * dx + dz * dz)
    } else {
      length = 0
    }

    const SAMPLES = 10
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES
      const elev = startElev + (endElev - startElev) * t
      profile.push({
        distance: cumulativeDistance + length * t,
        elevation: elev,
        roadId: currentRoad.id,
      })
    }

    cumulativeDistance += length

    const exitEndpoint = currentEndpoint === 'start' ? 'end' : 'start'
    const exitPoint = exitEndpoint === 'end' ? currentRoad.endPoint : currentRoad.startPoint
    if (!exitPoint) break

    let nextRoad: PlacedObject | null = null
    let nextEndpoint: 'start' | 'end' = 'start'

    for (const r of roads) {
      if (visited.has(r.id) || !r.startPoint || !r.endPoint) continue
      const dxS = exitPoint[0] - r.startPoint[0]
      const dzS = exitPoint[2] - r.startPoint[2]
      if (Math.sqrt(dxS * dxS + dzS * dzS) < SNAP) {
        nextRoad = r
        nextEndpoint = 'start'
        break
      }
      const dxE = exitPoint[0] - r.endPoint[0]
      const dzE = exitPoint[2] - r.endPoint[2]
      if (Math.sqrt(dxE * dxE + dzE * dzE) < SNAP) {
        nextRoad = r
        nextEndpoint = 'end'
        break
      }
    }

    currentRoad = nextRoad
    currentEndpoint = nextEndpoint
  }

  return profile
}

export default function ElevationProfile() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const elevationEditMode = useEditorStore(s => s.elevationEditMode)
  const [visible, setVisible] = useState(false)
  const [hoveredRoadId, setHoveredRoadId] = useState<string | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyB') setVisible(v => !v)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const profile = useMemo(() => buildElevationProfile(placedObjects), [placedObjects])

  useEffect(() => {
    if (!visible || !canvasRef.current || profile.length === 0) return

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvasRef.current.width = CANVAS_WIDTH * dpr
    canvasRef.current.height = CANVAS_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.beginPath()
    ctx.roundRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 8)
    ctx.fill()

    const plotWidth = CANVAS_WIDTH - PADDING.left - PADDING.right
    const plotHeight = CANVAS_HEIGHT - PADDING.top - PADDING.bottom

    const maxDist = profile[profile.length - 1].distance || 1
    let maxElev = 0
    for (const p of profile) {
      if (p.elevation > maxElev) maxElev = p.elevation
    }
    maxElev = Math.max(maxElev, 2)

    const toX = (d: number) => PADDING.left + (d / maxDist) * plotWidth
    const toY = (e: number) => PADDING.top + plotHeight - (e / maxElev) * plotHeight

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 0.5
    const elevStep = maxElev > 10 ? 5 : maxElev > 4 ? 2 : 1
    for (let e = 0; e <= maxElev; e += elevStep) {
      const y = toY(e)
      ctx.beginPath()
      ctx.moveTo(PADDING.left, y)
      ctx.lineTo(PADDING.left + plotWidth, y)
      ctx.stroke()

      ctx.fillStyle = '#666'
      ctx.font = '9px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${e}m`, PADDING.left - 4, y + 3)
    }

    ctx.fillStyle = '#666'
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    const distStep = maxDist > 500 ? 200 : maxDist > 200 ? 100 : 50
    for (let d = 0; d <= maxDist; d += distStep) {
      const x = toX(d)
      ctx.fillText(`${Math.round(d)}m`, x, CANVAS_HEIGHT - 4)
    }

    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.beginPath()
    ctx.moveTo(toX(profile[0].distance), toY(0))
    for (const p of profile) {
      ctx.lineTo(toX(p.distance), toY(p.elevation))
    }
    ctx.lineTo(toX(profile[profile.length - 1].distance), toY(0))
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < profile.length; i++) {
      const p = profile[i]
      const x = toX(p.distance)
      const y = toY(p.elevation)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    if (hoveredRoadId) {
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 3
      ctx.beginPath()
      let started = false
      for (const p of profile) {
        if (p.roadId === hoveredRoadId) {
          const x = toX(p.distance)
          const y = toY(p.elevation)
          if (!started) { ctx.moveTo(x, y); started = true }
          else ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    ctx.fillStyle = '#aaa'
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Elevation Profile', PADDING.left, 11)

    ctx.fillStyle = '#666'
    ctx.font = '8px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('[B]', CANVAS_WIDTH - 8, 11)
  }, [visible, profile, hoveredRoadId])

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || profile.length === 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const plotWidth = CANVAS_WIDTH - PADDING.left - PADDING.right
    const maxDist = profile[profile.length - 1].distance || 1
    const dist = ((x - PADDING.left) / plotWidth) * maxDist

    let closest: typeof profile[0] | null = null
    let bestDelta = Infinity
    for (const p of profile) {
      const d = Math.abs(p.distance - dist)
      if (d < bestDelta) { bestDelta = d; closest = p }
    }
    setHoveredRoadId(closest?.roadId ?? null)
  }

  if (!visible || !elevationEditMode || profile.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      pointerEvents: 'auto',
    }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          borderRadius: 8,
          cursor: 'crosshair',
        }}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={() => setHoveredRoadId(null)}
      />
    </div>
  )
}
