import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEditorCameraState } from '@/components/canvas/Camera/EditorCamera'
import { useCarStore } from '@/stores/useCarStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { isCustomizeStatus, useGameStore } from '@/stores/useGameStore'
import { useGhostCarStore } from '@/stores/useGhostCarStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { DIRECTIONS, MINIMAP_SIZE, ROTATION_ANGLES } from './constants'
import { drawCameraView, drawCar, drawGhost } from './drawing/drawCar'
import { drawCheckpoints } from './drawing/drawCheckpoints'
import { drawCompass } from './drawing/drawCompass'
import { drawRoads } from './drawing/drawRoads'
import { computeBounds, makeTransforms } from './helpers'

export default function TrackMinimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const [dirIndex, setDirIndex] = useState(0)
  const rotationRef = useRef(0)
  rotationRef.current = ROTATION_ANGLES[dirIndex]

  const bounds = useMemo(() => computeBounds(placedObjects), [placedObjects])

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

      const transforms = makeTransforms(currentBounds, rotationRef.current)

      const objects = useCustomizationStore.getState().placedObjects
      const roads = objects.filter(o => o.type === 'road' && o.startPoint && o.endPoint)
      drawRoads(ctx, roads, transforms)

      const curSector = useLapTimeStore.getState().currentSector
      const checkpoints = objects.filter(o => o.type === 'checkpoint')
      drawCheckpoints(ctx, checkpoints, curSector, transforms)

      const isCustomize = isCustomizeStatus(useGameStore.getState().status)
      if (isCustomize) {
        const camState = getEditorCameraState()
        drawCameraView(ctx, camState.targetX, camState.targetZ, camState.distance, transforms)
      } else {
        const ghostPos = useGhostCarStore.getState().ghostPosition
        const laps = useLapTimeStore.getState().lapCount
        if (ghostPos && laps >= 1) drawGhost(ctx, ghostPos, transforms)
        drawCar(ctx, useCarStore.getState().position, transforms)
      }

      drawCompass(ctx, rotationRef.current)

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
        top: 92,
        width: MINIMAP_SIZE,
        height: MINIMAP_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 30,
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
