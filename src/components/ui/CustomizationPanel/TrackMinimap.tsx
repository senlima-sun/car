import { useRef, useEffect, useMemo } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'

const MINIMAP_SIZE = 200
const PADDING = 15

export default function TrackMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  const bounds = useMemo(() => {
    const roads = placedObjects.filter(o => o.type === 'road' && o.startPoint && o.endPoint)
    if (roads.length === 0) return null

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity

    for (const road of roads) {
      const points = [road.startPoint!, road.endPoint!]
      if (road.controlPoint) points.push(road.controlPoint)

      for (const p of points) {
        minX = Math.min(minX, p[0])
        maxX = Math.max(maxX, p[0])
        minZ = Math.min(minZ, p[2])
        maxZ = Math.max(maxZ, p[2])
      }
    }

    const rangeX = maxX - minX || 1
    const rangeZ = maxZ - minZ || 1
    const maxRange = Math.max(rangeX, rangeZ)

    return { minX, maxX, minZ, maxZ, rangeX, rangeZ, maxRange }
  }, [placedObjects])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bounds) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = MINIMAP_SIZE * dpr
    canvas.height = MINIMAP_SIZE * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    const drawSize = MINIMAP_SIZE - PADDING * 2
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerZ = (bounds.minZ + bounds.maxZ) / 2
    const scale = drawSize / bounds.maxRange

    const toScreenX = (x: number) => PADDING + (x - centerX) * scale + drawSize / 2
    const toScreenZ = (z: number) => PADDING + (z - centerZ) * scale + drawSize / 2

    const roads = placedObjects.filter(o => o.type === 'road' && o.startPoint && o.endPoint)

    for (const road of roads) {
      ctx.beginPath()

      const maxElev = Math.max(road.startElevation ?? 0, road.endElevation ?? 0)
      if (maxElev > 0) {
        const intensity = Math.min(1, maxElev / 20)
        const r = Math.round(100 + 155 * (1 - intensity))
        const g = Math.round(100 + 155 * (1 - intensity))
        const b = Math.round(170 + 85 * intensity)
        ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`
      } else {
        ctx.strokeStyle = road.flowDirection ? '#22c55e' : '#aaaaaa'
      }

      ctx.lineWidth = 2.5

      if (road.trackMode === 'curve' && road.controlPoint) {
        const sx = toScreenX(road.startPoint![0])
        const sz = toScreenZ(road.startPoint![2])
        const cpx = toScreenX(road.controlPoint[0])
        const cpz = toScreenZ(road.controlPoint[2])
        const ex = toScreenX(road.endPoint![0])
        const ez = toScreenZ(road.endPoint![2])

        ctx.moveTo(sx, sz)
        ctx.quadraticCurveTo(cpx, cpz, ex, ez)
      } else {
        const sx = toScreenX(road.startPoint![0])
        const sz = toScreenZ(road.startPoint![2])
        const ex = toScreenX(road.endPoint![0])
        const ez = toScreenZ(road.endPoint![2])

        ctx.moveTo(sx, sz)
        ctx.lineTo(ex, ez)
      }

      ctx.stroke()

      if (road.flowDirection) {
        const isForward = road.flowDirection === 'forward'
        let mx: number, mz: number, dx: number, dz: number

        if (road.trackMode === 'curve' && road.controlPoint) {
          const t = 0.5
          const s0x = road.startPoint![0]
          const s0z = road.startPoint![2]
          const cpx = road.controlPoint[0]
          const cpz = road.controlPoint[2]
          const e0x = road.endPoint![0]
          const e0z = road.endPoint![2]

          mx = toScreenX((1 - t) * (1 - t) * s0x + 2 * (1 - t) * t * cpx + t * t * e0x)
          mz = toScreenZ((1 - t) * (1 - t) * s0z + 2 * (1 - t) * t * cpz + t * t * e0z)

          const tangentX = 2 * (1 - t) * (cpx - s0x) + 2 * t * (e0x - cpx)
          const tangentZ = 2 * (1 - t) * (cpz - s0z) + 2 * t * (e0z - cpz)
          const len = Math.sqrt(tangentX * tangentX + tangentZ * tangentZ) || 1
          dx = (tangentX / len) * scale
          dz = (tangentZ / len) * scale
        } else {
          const sx = road.startPoint![0]
          const sz = road.startPoint![2]
          const ex = road.endPoint![0]
          const ez = road.endPoint![2]

          mx = toScreenX((sx + ex) / 2)
          mz = toScreenZ((sz + ez) / 2)

          const rawDx = ex - sx
          const rawDz = ez - sz
          const len = Math.sqrt(rawDx * rawDx + rawDz * rawDz) || 1
          dx = (rawDx / len) * scale
          dz = (rawDz / len) * scale
        }

        if (!isForward) {
          dx = -dx
          dz = -dz
        }

        const normLen = Math.sqrt(dx * dx + dz * dz) || 1
        const ndx = dx / normLen
        const ndz = dz / normLen

        const arrowSize = 5

        ctx.beginPath()
        ctx.fillStyle = '#22c55e'
        ctx.moveTo(mx + ndx * arrowSize, mz + ndz * arrowSize)
        ctx.lineTo(mx - ndx * arrowSize * 0.5 + ndz * arrowSize * 0.5, mz - ndz * arrowSize * 0.5 - ndx * arrowSize * 0.5)
        ctx.lineTo(mx - ndx * arrowSize * 0.5 - ndz * arrowSize * 0.5, mz - ndz * arrowSize * 0.5 + ndx * arrowSize * 0.5)
        ctx.closePath()
        ctx.fill()
      }
    }

    const checkpoints = placedObjects.filter(o => o.type === 'checkpoint')
    for (const cp of checkpoints) {
      const isStartFinish = (cp.checkpointType ?? 'start-finish') === 'start-finish'

      if (cp.startPoint && cp.endPoint) {
        ctx.beginPath()
        ctx.strokeStyle = isStartFinish ? '#ffffff' : '#3b82f6'
        ctx.lineWidth = isStartFinish ? 3 : 2
        ctx.moveTo(toScreenX(cp.startPoint[0]), toScreenZ(cp.startPoint[2]))
        ctx.lineTo(toScreenX(cp.endPoint[0]), toScreenZ(cp.endPoint[2]))
        ctx.stroke()
      } else {
        const cx = toScreenX(cp.position[0])
        const cz = toScreenZ(cp.position[2])

        ctx.beginPath()
        ctx.fillStyle = isStartFinish ? '#ffffff' : '#3b82f6'
        ctx.arc(cx, cz, isStartFinish ? 4 : 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
  }, [placedObjects, bounds])

  if (!bounds) return null

  return (
    <div
      style={{
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: MINIMAP_SIZE,
        height: MINIMAP_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: MINIMAP_SIZE,
          height: MINIMAP_SIZE,
        }}
      />
    </div>
  )
}
