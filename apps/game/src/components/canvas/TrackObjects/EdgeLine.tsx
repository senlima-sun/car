import { useEffect, useMemo } from 'react'
import { BufferGeometry } from 'three'
import { TRACK_LAYER_POLYGON_OFFSETS } from '@/constants/trackLayers'
import { GHOST_OPACITY } from '@/constants/trackObjects'
import { resolveEdgeLineGeometries } from './geometry/derivedLayerResolvers'
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

  const geometries = useMemo<BufferGeometry[]>(
    () => resolveEdgeLineGeometries(placed, parentRibbon, 0.2),
    [placed, parentRibbon],
  )

  useEffect(
    () => () => {
      for (const g of geometries) g.dispose()
    },
    [geometries],
  )

  if (geometries.length === 0) return null

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g}>
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
      ))}
    </group>
  )
}
