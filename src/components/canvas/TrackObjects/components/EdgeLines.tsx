import { BufferGeometry } from 'three'
import { GHOST_OPACITY } from '../../../../constants/trackObjects'

interface EdgeLinesProps {
  leftGeometry: BufferGeometry | null
  rightGeometry: BufferGeometry | null
  isGhost: boolean
}

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
            side={2}
          />
        </mesh>
      )}
    </>
  )
}
