import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useCarStore } from '../../../stores/useCarStore'
import { useGhostCarStore } from '../../../stores/useGhostCarStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { isCustomizeStatus, useGameStore } from '../../../stores/useGameStore'
import { getEditorCameraState } from '../../canvas/Camera/EditorCamera'
import { isCurveMode } from '../../../types/trackObjects'

const MINIMAP_SIZE = 200
const PADDING = 15
const DIRECTIONS = ['N', 'E', 'S', 'W'] as const
const ROTATION_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const

export default function TrackMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const [dirIndex, setDirIndex] = useState(0)
  const rotationRef = useRef(0)
  rotationRef.current = ROTATION_ANGLES[dirIndex]

  const bounds = useMemo(() => {
    const roads = placedObjects.filter(o => o.type === 'road' && o.startPoint && o.endPoint)
    if (roads.length === 0) return null

    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity

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

  const drawMinimap = useCallback(
    (ctx: CanvasRenderingContext2D, currentBounds: NonNullable<typeof bounds>) => {
      const dpr = window.devicePixelRatio || 1
      const canvas = ctx.canvas
      const needsResize =
        canvas.width !== MINIMAP_SIZE * dpr || canvas.height !== MINIMAP_SIZE * dpr
      if (needsResize) {
        canvas.width = MINIMAP_SIZE * dpr
        canvas.height = MINIMAP_SIZE * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

      const drawSize = MINIMAP_SIZE - PADDING * 2
      const centerX = (currentBounds.minX + currentBounds.maxX) / 2
      const centerZ = (currentBounds.minZ + currentBounds.maxZ) / 2
      const scale = drawSize / currentBounds.maxRange

      const half = MINIMAP_SIZE / 2
      const angle = rotationRef.current

      const toScreenX = (x: number) => PADDING + (x - centerX) * scale + drawSize / 2
      const toScreenZ = (z: number) => PADDING + (z - centerZ) * scale + drawSize / 2

      const rotX = (sx: number, sz: number) => {
        const dx = sx - half
        const dz = sz - half
        return half + dx * Math.cos(angle) - dz * Math.sin(angle)
      }
      const rotZ = (sx: number, sz: number) => {
        const dx = sx - half
        const dz = sz - half
        return half + dx * Math.sin(angle) + dz * Math.cos(angle)
      }

      const objects = useCustomizationStore.getState().placedObjects
      const roads = objects.filter(o => o.type === 'road' && o.startPoint && o.endPoint)

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

        if (isCurveMode(road.trackMode) && road.controlPoint) {
          const sx = toScreenX(road.startPoint![0])
          const sz = toScreenZ(road.startPoint![2])
          const cpx = toScreenX(road.controlPoint[0])
          const cpz = toScreenZ(road.controlPoint[2])
          const ex = toScreenX(road.endPoint![0])
          const ez = toScreenZ(road.endPoint![2])

          ctx.moveTo(rotX(sx, sz), rotZ(sx, sz))
          ctx.quadraticCurveTo(rotX(cpx, cpz), rotZ(cpx, cpz), rotX(ex, ez), rotZ(ex, ez))
        } else {
          const sx = toScreenX(road.startPoint![0])
          const sz = toScreenZ(road.startPoint![2])
          const ex = toScreenX(road.endPoint![0])
          const ez = toScreenZ(road.endPoint![2])

          ctx.moveTo(rotX(sx, sz), rotZ(sx, sz))
          ctx.lineTo(rotX(ex, ez), rotZ(ex, ez))
        }

        ctx.stroke()

        if (road.flowDirection) {
          const isForward = road.flowDirection === 'forward'
          let mx: number, mz: number, dx: number, dz: number

          if (isCurveMode(road.trackMode) && road.controlPoint) {
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

          const rndx = ndx * Math.cos(angle) - ndz * Math.sin(angle)
          const rndz = ndx * Math.sin(angle) + ndz * Math.cos(angle)

          const rmx = rotX(mx, mz)
          const rmz = rotZ(mx, mz)

          const arrowSize = 5

          ctx.beginPath()
          ctx.fillStyle = '#22c55e'
          ctx.moveTo(rmx + rndx * arrowSize, rmz + rndz * arrowSize)
          ctx.lineTo(
            rmx - rndx * arrowSize * 0.5 + rndz * arrowSize * 0.5,
            rmz - rndz * arrowSize * 0.5 - rndx * arrowSize * 0.5,
          )
          ctx.lineTo(
            rmx - rndx * arrowSize * 0.5 - rndz * arrowSize * 0.5,
            rmz - rndz * arrowSize * 0.5 + rndx * arrowSize * 0.5,
          )
          ctx.closePath()
          ctx.fill()
        }
      }

      const curSector = useLapTimeStore.getState().currentSector
      const checkpoints = objects.filter(o => o.type === 'checkpoint')
      for (const cp of checkpoints) {
        const isStartFinish = (cp.checkpointType ?? 'start-finish') === 'start-finish'
        const isSector = cp.checkpointType === 'sector'
        const isCurrentSector = isSector && cp.checkpointOrder === curSector

        if (cp.startPoint && cp.endPoint) {
          const s0x = toScreenX(cp.startPoint[0])
          const s0z = toScreenZ(cp.startPoint[2])
          const e0x = toScreenX(cp.endPoint[0])
          const e0z = toScreenZ(cp.endPoint[2])
          const midX = (rotX(s0x, s0z) + rotX(e0x, e0z)) / 2
          const midZ = (rotZ(s0x, s0z) + rotZ(e0x, e0z)) / 2

          ctx.beginPath()
          if (isCurrentSector) {
            ctx.fillStyle = '#f87171'
            ctx.shadowColor = '#f87171'
            ctx.shadowBlur = 6
          } else {
            ctx.fillStyle = isStartFinish ? '#ffffff' : '#ef4444'
            ctx.shadowBlur = 0
          }
          ctx.arc(midX, midZ, isStartFinish ? 5 : 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          if (isSector && cp.checkpointOrder != null) {
            ctx.font = 'bold 9px Arial, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.fillStyle = isCurrentSector ? '#f87171' : '#ef4444'
            ctx.fillText(`S${cp.checkpointOrder}`, midX, midZ - 6)
          }
        } else {
          const rawX = toScreenX(cp.position[0])
          const rawZ = toScreenZ(cp.position[2])
          const cx = rotX(rawX, rawZ)
          const cz = rotZ(rawX, rawZ)

          ctx.beginPath()
          if (isCurrentSector) {
            ctx.fillStyle = '#f87171'
            ctx.shadowColor = '#f87171'
            ctx.shadowBlur = 6
          } else {
            ctx.fillStyle = isStartFinish ? '#ffffff' : '#ef4444'
            ctx.shadowBlur = 0
          }
          ctx.arc(cx, cz, isStartFinish ? 5 : 4, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 0

          if (isSector && cp.checkpointOrder != null) {
            ctx.font = 'bold 9px Arial, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.fillStyle = isCurrentSector ? '#f87171' : '#ef4444'
            ctx.fillText(`S${cp.checkpointOrder}`, cx, cz - 6)
          }
        }
      }

      const isCustomize = isCustomizeStatus(useGameStore.getState().status)

      if (isCustomize) {
        const camState = getEditorCameraState()
        const camSx = toScreenX(camState.targetX)
        const camSz = toScreenZ(camState.targetZ)
        const camRx = rotX(camSx, camSz)
        const camRz = rotZ(camSx, camSz)

        const viewRadius = camState.distance * scale * 0.6
        const clampedRadius = Math.max(8, Math.min(viewRadius, drawSize * 0.45))

        ctx.beginPath()
        ctx.arc(camRx, camRz, clampedRadius, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(camRx, camRz, clampedRadius, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.fill()

        ctx.beginPath()
        ctx.arc(camRx, camRz, 3, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
      } else {
        const ghostPos = useGhostCarStore.getState().ghostPosition
        const laps = useLapTimeStore.getState().lapCount
        if (ghostPos && laps >= 1) {
          const rawGx = toScreenX(ghostPos[0])
          const rawGz = toScreenZ(ghostPos[2])
          const gx = rotX(rawGx, rawGz)
          const gz = rotZ(rawGx, rawGz)
          ctx.beginPath()
          ctx.arc(gx, gz, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#00ccff'
          ctx.shadowColor = '#00ccff'
          ctx.shadowBlur = 6
          ctx.fill()
          ctx.shadowBlur = 0
        }

        const carPos = useCarStore.getState().position
        const rawCarX = toScreenX(carPos[0])
        const rawCarZ = toScreenZ(carPos[2])
        const carX = rotX(rawCarX, rawCarZ)
        const carZ = rotZ(rawCarX, rawCarZ)
        ctx.beginPath()
        ctx.arc(carX, carZ, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#00ff88'
        ctx.shadowColor = '#00ff88'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      }

      const compassR = 12
      const compassCx = MINIMAP_SIZE - compassR - 6
      const compassCy = compassR + 6
      const northAngle = -Math.PI / 2 + angle

      ctx.save()
      ctx.beginPath()
      ctx.arc(compassCx, compassCy, compassR, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()

      const tipX = compassCx + Math.cos(northAngle) * (compassR - 3)
      const tipY = compassCy + Math.sin(northAngle) * (compassR - 3)
      const leftAngle = northAngle + (2.6)
      const rightAngle = northAngle - (2.6)
      const baseR = compassR * 0.5
      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(compassCx + Math.cos(leftAngle) * baseR, compassCy + Math.sin(leftAngle) * baseR)
      ctx.lineTo(compassCx, compassCy)
      ctx.closePath()
      ctx.fillStyle = '#ef4444'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(compassCx + Math.cos(rightAngle) * baseR, compassCy + Math.sin(rightAngle) * baseR)
      ctx.lineTo(compassCx, compassCy)
      ctx.closePath()
      ctx.fillStyle = '#991b1b'
      ctx.fill()

      ctx.font = 'bold 8px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText('N', tipX + Math.cos(northAngle) * 1, tipY + Math.sin(northAngle) * 1)
      ctx.restore()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
    },
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bounds) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const loop = () => {
      drawMinimap(ctx, bounds)
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(animId)
  }, [bounds, drawMinimap])

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
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: MINIMAP_SIZE,
          height: MINIMAP_SIZE,
        }}
      />
      <button
        onClick={() => setDirIndex(i => (i + 1) % 4)}
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          zIndex: 1,
          pointerEvents: 'auto',
          width: 24,
          height: 24,
          borderRadius: 4,
          border: '1px solid rgba(255, 255, 255, 0.3)',
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#ffffff',
          fontSize: 11,
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          lineHeight: 1,
        }}
        title={`Facing ${DIRECTIONS[(dirIndex + 1) % 4]}`}
      >
        {DIRECTIONS[dirIndex]}
      </button>
    </div>
  )
}
