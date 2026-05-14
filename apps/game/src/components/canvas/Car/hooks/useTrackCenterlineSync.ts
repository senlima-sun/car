import { useEffect, useRef } from 'react'
import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import type { TrackRibbonPoint } from '../../../../types/trackObjects'
import { usePhysics } from '../../../../wasm'

function findActiveRibbon(
  placedObjects: { type: string; ribbonPoints?: TrackRibbonPoint[] }[],
): TrackRibbonPoint[] | null {
  for (const obj of placedObjects) {
    if (obj.type !== 'track_ribbon') continue
    const points = obj.ribbonPoints
    if (!points || points.length < 2) continue
    const racing = points.filter(p => !p.isPitLane)
    if (racing.length >= 2) return racing
  }
  return null
}

export function useTrackCenterlineSync(): void {
  const physics = usePhysics()
  const placedObjects = useCustomizationStore(state => state.placedObjects)
  const lastRibbonRef = useRef<TrackRibbonPoint[] | null>(null)

  useEffect(() => {
    const racing = findActiveRibbon(placedObjects)
    if (racing === lastRibbonRef.current) return
    lastRibbonRef.current = racing
    if (!racing) return

    const flat = new Float32Array(racing.length * 2)
    for (let i = 0; i < racing.length; i++) {
      flat[i * 2] = racing[i].x
      flat[i * 2 + 1] = racing[i].z
    }
    physics.setTrackCenterline(flat)
  }, [placedObjects, physics])
}
