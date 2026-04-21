import { memo, useCallback, useRef, useEffect, useState } from 'react'
import { useEditorStore } from '@/stores/useEditorStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { isCurveMode, type SnapPointWithDirection } from '@/types/trackObjects'
import { getSnapPoints } from '@/utils/roadGeometry'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import type { useSVGCoordinates as UseSVGCoordinates } from '../hooks/useSVGCoordinates'

interface SVGRoadHandlesProps {
  zoom: number
  screenToWorld: ReturnType<typeof UseSVGCoordinates>['screenToWorld']
}

interface RoadDragState {
  roadId: string
  handle: 'start' | 'end' | 'control' | 'midpoint'
  initialStart: [number, number, number]
  initialEnd: [number, number, number]
  initialControl: [number, number, number] | undefined
  initialTrackMode: string | undefined
  initialStartLeftEdge: [number, number, number] | undefined
  initialStartRightEdge: [number, number, number] | undefined
  initialEndLeftEdge: [number, number, number] | undefined
  initialEndRightEdge: [number, number, number] | undefined
}

const ENDPOINT_SNAP_RADIUS = 5

function findEndpointSnap(
  position: [number, number, number],
  excludeRoadId: string,
): SnapPointWithDirection | null {
  const objects = useCustomizationStore.getState().placedObjects
  const others = objects.filter(o => o.id !== excludeRoadId)
  const snapPoints = getSnapPoints(others)

  let best: SnapPointWithDirection | null = null
  let bestDist = ENDPOINT_SNAP_RADIUS

  for (const sp of snapPoints) {
    const dx = sp.position[0] - position[0]
    const dz = sp.position[2] - position[2]
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < bestDist) {
      bestDist = dist
      best = sp
    }
  }
  return best
}

export const SVGRoadHandles = memo(function SVGRoadHandles({
  zoom,
  screenToWorld,
}: SVGRoadHandlesProps) {
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  const road = selectedObjectId
    ? placedObjects.find(o => o.id === selectedObjectId && o.type === 'road')
    : null

  const dragState = useRef<RoadDragState | null>(null)
  const [snapTarget, setSnapTarget] = useState<SnapPointWithDirection | null>(null)

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end' | 'control' | 'midpoint', e: React.PointerEvent) => {
      e.stopPropagation()
      if (!road || !road.startPoint || !road.endPoint) return

      dragState.current = {
        roadId: road.id,
        handle,
        initialStart: [...road.startPoint] as [number, number, number],
        initialEnd: [...road.endPoint] as [number, number, number],
        initialControl: road.controlPoint
          ? ([...road.controlPoint] as [number, number, number])
          : undefined,
        initialTrackMode: road.trackMode,
        initialStartLeftEdge: road.startLeftEdge
          ? ([...road.startLeftEdge] as [number, number, number])
          : undefined,
        initialStartRightEdge: road.startRightEdge
          ? ([...road.startRightEdge] as [number, number, number])
          : undefined,
        initialEndLeftEdge: road.endLeftEdge
          ? ([...road.endLeftEdge] as [number, number, number])
          : undefined,
        initialEndRightEdge: road.endRightEdge
          ? ([...road.endRightEdge] as [number, number, number])
          : undefined,
      }
    },
    [road],
  )

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const ds = dragState.current
      if (!ds) return

      const world = screenToWorld(e.clientX, e.clientY)
      if (!world) return

      const store = useCustomizationStore.getState()
      const obj = store.placedObjects.find(o => o.id === ds.roadId)
      if (!obj || !obj.startPoint || !obj.endPoint) return

      const updates: Record<string, unknown> = {}

      if (ds.handle === 'start' || ds.handle === 'end') {
        const snap = findEndpointSnap(world, ds.roadId)
        setSnapTarget(snap)
        const effective: [number, number, number] = snap ? snap.position : world

        if (ds.handle === 'start') {
          updates.startPoint = effective
          updates.position = [
            (effective[0] + obj.endPoint[0]) / 2,
            0,
            (effective[2] + obj.endPoint[2]) / 2,
          ]
          if (snap) {
            updates.startLeftEdge = snap.leftEdge
            updates.startRightEdge = snap.rightEdge
          } else {
            updates.startLeftEdge = undefined
            updates.startRightEdge = undefined
          }
        } else {
          updates.endPoint = effective
          updates.position = [
            (obj.startPoint[0] + effective[0]) / 2,
            0,
            (obj.startPoint[2] + effective[2]) / 2,
          ]
          if (snap) {
            updates.endLeftEdge = snap.leftEdge
            updates.endRightEdge = snap.rightEdge
          } else {
            updates.endLeftEdge = undefined
            updates.endRightEdge = undefined
          }
        }
      } else if (ds.handle === 'control') {
        updates.controlPoint = world
      } else if (ds.handle === 'midpoint') {
        updates.controlPoint = world
        if (!isCurveMode(obj.trackMode)) {
          if (obj.trackMode === 'pitroad') {
            updates.trackMode = 'pitroad-curve'
          } else {
            updates.trackMode = 'curve'
          }
        }
      }

      store.updateObject(ds.roadId, updates)
    }

    const handleUp = () => {
      dragState.current = null
      setSnapTarget(null)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.current) {
        const ds = dragState.current
        useCustomizationStore.getState().updateObject(ds.roadId, {
          startPoint: ds.initialStart,
          endPoint: ds.initialEnd,
          controlPoint: ds.initialControl,
          trackMode: ds.initialTrackMode as never,
          startLeftEdge: ds.initialStartLeftEdge,
          startRightEdge: ds.initialStartRightEdge,
          endLeftEdge: ds.initialEndLeftEdge,
          endRightEdge: ds.initialEndRightEdge,
          position: [
            (ds.initialStart[0] + ds.initialEnd[0]) / 2,
            0,
            (ds.initialStart[2] + ds.initialEnd[2]) / 2,
          ],
        })
        dragState.current = null
        setSnapTarget(null)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [screenToWorld])

  if (!road || !road.startPoint || !road.endPoint) return null

  const [sx, sy] = worldToSVG(road.startPoint[0], road.startPoint[2])
  const [ex, ey] = worldToSVG(road.endPoint[0], road.endPoint[2])
  const hasCurve = isCurveMode(road.trackMode) && road.controlPoint
  const r = 3 / zoom
  const strokeW = 1 / zoom

  const midWorldX =
    hasCurve && road.controlPoint
      ? (road.startPoint[0] + 2 * road.controlPoint[0] + road.endPoint[0]) / 4
      : (road.startPoint[0] + road.endPoint[0]) / 2
  const midWorldZ =
    hasCurve && road.controlPoint
      ? (road.startPoint[2] + 2 * road.controlPoint[2] + road.endPoint[2]) / 4
      : (road.startPoint[2] + road.endPoint[2]) / 2
  const [mx, my] = worldToSVG(midWorldX, midWorldZ)

  const snapIndicator = snapTarget
    ? worldToSVG(snapTarget.position[0], snapTarget.position[2])
    : null

  return (
    <g>
      {snapIndicator && (
        <g style={{ pointerEvents: 'none' }}>
          <circle
            cx={snapIndicator[0]}
            cy={snapIndicator[1]}
            r={r * 1.8}
            fill='none'
            stroke='#00ffff'
            strokeWidth={strokeW * 1.5}
            opacity={0.9}
          />
          <circle
            cx={snapIndicator[0]}
            cy={snapIndicator[1]}
            r={r * 2.6}
            fill='none'
            stroke='#00ffff'
            strokeWidth={strokeW * 0.6}
            opacity={0.4}
          />
        </g>
      )}
      <circle
        cx={sx}
        cy={sy}
        r={r}
        fill='#00ff00'
        fillOpacity={0.3}
        stroke='#00ff00'
        strokeWidth={strokeW}
        cursor='grab'
        onPointerDown={e => handlePointerDown('start', e)}
      />
      <circle
        cx={ex}
        cy={ey}
        r={r}
        fill='#ff4444'
        fillOpacity={0.3}
        stroke='#ff4444'
        strokeWidth={strokeW}
        cursor='grab'
        onPointerDown={e => handlePointerDown('end', e)}
      />
      {!hasCurve && (
        <circle
          cx={mx}
          cy={my}
          r={r * 0.6}
          fill='#cc66ff'
          fillOpacity={0.3}
          stroke='#cc66ff'
          strokeWidth={strokeW}
          cursor='grab'
          onPointerDown={e => handlePointerDown('midpoint', e)}
        />
      )}
      {hasCurve &&
        road.controlPoint &&
        (() => {
          const [cpx, cpy] = worldToSVG(road.controlPoint[0], road.controlPoint[2])
          return (
            <>
              <line
                x1={sx}
                y1={sy}
                x2={cpx}
                y2={cpy}
                stroke='#ffff00'
                strokeWidth={0.5 / zoom}
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
              <line
                x1={cpx}
                y1={cpy}
                x2={ex}
                y2={ey}
                stroke='#ffff00'
                strokeWidth={0.5 / zoom}
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
              <circle
                cx={cpx}
                cy={cpy}
                r={r * 0.7}
                fill='#ffff00'
                fillOpacity={0.3}
                stroke='#ffff00'
                strokeWidth={strokeW}
                cursor='grab'
                onPointerDown={e => handlePointerDown('control', e)}
              />
            </>
          )
        })()}
    </g>
  )
})
