import { BufferGeometry } from 'three'

interface RoadSelectionHighlightProps {
  isSelected: boolean
  geometry?: BufferGeometry | null
  position?: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  length?: number
}

export function RoadSelectionHighlight({
  isSelected,
  geometry,
  position,
  rotation,
  width,
  length,
}: RoadSelectionHighlightProps) {
  if (!isSelected) return null

  if (geometry) {
    return (
      <mesh geometry={geometry}>
        <meshBasicMaterial color='#22c55e' transparent opacity={0.3} depthWrite={false} />
      </mesh>
    )
  }

  if (position && rotation && width && length) {
    return (
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={[width + 0.5, length + 0.5]} />
        <meshBasicMaterial color='#22c55e' transparent opacity={0.3} depthWrite={false} />
      </mesh>
    )
  }

  return null
}
