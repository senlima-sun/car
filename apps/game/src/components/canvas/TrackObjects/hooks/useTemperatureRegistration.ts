import { useEffect } from 'react'
import { usePhysicsOptional } from '../../../../wasm'

interface RoadBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function useTemperatureRegistration(isGhost: boolean, roadBounds: RoadBounds | null) {
  const physics = usePhysicsOptional()

  useEffect(() => {
    if (isGhost || !roadBounds) return

    const { minX, maxX, minZ, maxZ } = roadBounds

    if (physics) {
      physics.setRoadRegion(minX, minZ, maxX, maxZ, true)
    }

    return () => {
      if (physics) {
        physics.setRoadRegion(minX, minZ, maxX, maxZ, false)
      }
    }
  }, [isGhost, physics, roadBounds])
}
