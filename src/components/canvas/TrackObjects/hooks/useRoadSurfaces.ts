import { useCallback } from 'react'
import { useSurfaceStore } from '../../../../stores/useSurfaceStore'
import { useElevationStore } from '../../../../stores/useElevationStore'

interface RoadSurfaceOptions {
  startElevation: number
  endElevation: number
  length: number
  banking?: number
}

export function useRoadSurfaces({
  startElevation,
  endElevation,
  length,
  banking,
}: RoadSurfaceOptions) {
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)
  const enterElevation = useElevationStore(s => s.enterRoad)
  const exitElevation = useElevationStore(s => s.exitRoad)

  const handleEnterRoad = useCallback(() => {
    enterSurface('road')
    const midElev = (startElevation + endElevation) / 2
    const slopeAngle = Math.atan2(endElevation - startElevation, length)
    const bankingRad = banking ? (banking * Math.PI) / 180 : 0
    enterElevation(midElev, slopeAngle, bankingRad)
  }, [enterSurface, startElevation, endElevation, length, banking, enterElevation])

  const handleExitRoad = useCallback(() => {
    exitSurface('road')
    exitElevation()
  }, [exitSurface, exitElevation])

  return { handleEnterRoad, handleExitRoad }
}
