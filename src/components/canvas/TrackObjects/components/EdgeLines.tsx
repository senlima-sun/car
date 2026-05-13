import { BufferGeometry } from 'three'
import { GHOST_OPACITY } from '../../../../constants/trackObjects'
import { TRACK_LAYER_POLYGON_OFFSETS } from '../../../../constants/trackLayers'

interface EdgeLinesProps {
  leftGeometry: BufferGeometry | null
  rightGeometry: BufferGeometry | null
  isGhost: boolean
}

const { factor: EDGE_OFFSET_FACTOR, units: EDGE_OFFSET_UNITS } =
  TRACK_LAYER_POLYGON_OFFSETS.EDGE_LINE

export function EdgeLines({ leftGeometry, rightGeometry, isGhost }: EdgeLinesProps) {
  return (
    <>
      {leftGeometry && (
        <mesh geometry={leftGeometry}>
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
      )}
      {rightGeometry && (
        <mesh geometry={rightGeometry}>
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
      )}
    </>
  )
}
