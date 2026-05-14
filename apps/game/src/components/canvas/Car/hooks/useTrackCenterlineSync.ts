import { useEffect, useMemo } from 'react'
import { useCustomizationStore } from '../../../../stores/useCustomizationStore'
import { usePhysics } from '../../../../wasm'

export function useTrackCenterlineSync(): void {
  const physics = usePhysics()
  const placedObjects = useCustomizationStore(state => state.placedObjects)

  const centerline = useMemo<Float32Array | null>(() => {
    for (const obj of placedObjects) {
      if (obj.type !== 'track_ribbon') continue
      const points = obj.ribbonPoints
      if (!points || points.length < 2) continue
      const racing = points.filter(p => !p.isPitLane)
      if (racing.length < 2) continue
      const flat = new Float32Array(racing.length * 2)
      for (let i = 0; i < racing.length; i++) {
        flat[i * 2] = racing[i].x
        flat[i * 2 + 1] = racing[i].z
      }
      return flat
    }
    return null
  }, [placedObjects])

  useEffect(() => {
    if (centerline) {
      physics.setTrackCenterline(centerline)
    }
  }, [centerline, physics])
}
