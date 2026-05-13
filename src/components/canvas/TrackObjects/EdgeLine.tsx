import { useEffect, useMemo } from 'react'
import { TRACK_LAYER_POLYGON_OFFSETS } from '@/constants/trackLayers'
import { GHOST_OPACITY } from '@/constants/trackObjects'
import { resolveParentDerivedLayer } from '@/utils/parentDerivedLayer'
import { buildAsphaltGeometry } from './geometry/ribbonGeometry'
import type { PlacedObject } from '@/types/trackObjects'

interface EdgeLineProps {
  placed: PlacedObject
  parentRibbon: PlacedObject | undefined
  isGhost?: boolean
}

const { factor: EDGE_OFFSET_FACTOR, units: EDGE_OFFSET_UNITS } =
  TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE

export default function EdgeLine({ placed, parentRibbon, isGhost = false }: EdgeLineProps) {
  if (import.meta.env.DEV && placed.parentSide === undefined) {
    console.warn(`[EdgeLine] ${placed.id} parentSide is undefined; defaulting to 'right'.`)
  }

  const geometry = useMemo(() => {
    const resolved = resolveParentDerivedLayer(placed, { parent: parentRibbon })
    if (!resolved || resolved.points.length < 2) return null
    const built = buildAsphaltGeometry(resolved.points, resolved.closed, resolved.width)
    return built?.geometry ?? null
  }, [placed, parentRibbon])

  useEffect(
    () => () => {
      geometry?.dispose()
    },
    [geometry],
  )

  if (!geometry) return null

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color='#ffffff'
        transparent={isGhost}
        opacity={isGhost ? GHOST_OPACITY : 1}
        depthWrite={!isGhost}
        polygonOffset
        polygonOffsetFactor={EDGE_OFFSET_FACTOR}
        polygonOffsetUnits={EDGE_OFFSET_UNITS}
        side={2}
      />
    </mesh>
  )
}
