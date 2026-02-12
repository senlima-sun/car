import { useEffect } from 'react'
import { useTrackTemperatureStore } from '../../../../stores/useTrackTemperatureStore'
import { usePhysicsOptional } from '../../../../wasm'

interface RoadBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function useTemperatureRegistration(isGhost: boolean, roadBounds: RoadBounds | null) {
  const physics = usePhysicsOptional()
  const setRoadRegionTS = useTrackTemperatureStore(s => s.setRoadRegion)

  useEffect(() => {
    if (isGhost || !roadBounds) return

    const { minX, maxX, minZ, maxZ } = roadBounds

    if (physics) {
      physics.setRoadRegion(minX, minZ, maxX, maxZ, true)
    }
    setRoadRegionTS(minX, minZ, maxX, maxZ, true)

    return () => {
      if (physics) {
        physics.setRoadRegion(minX, minZ, maxX, maxZ, false)
      }
      setRoadRegionTS(minX, minZ, maxX, maxZ, false)
    }
  }, [isGhost, physics, setRoadRegionTS, roadBounds])
}
