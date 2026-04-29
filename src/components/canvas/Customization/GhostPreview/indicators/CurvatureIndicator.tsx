import { useMemo } from 'react'
import { Text } from '@react-three/drei'
import { computeCurvatureRadius } from '../utils/curvature'

export function CurvatureIndicator({
  start,
  control,
  end,
}: {
  start: [number, number, number]
  control: [number, number, number]
  end: [number, number, number]
}) {
  const { radius, center } = useMemo(
    () => computeCurvatureRadius(start, control, end),
    [start, control, end],
  )

  if (radius === Infinity || radius > 500) return null

  const displayRadius = Math.min(radius, 80)
  const ringSegments = 64

  const mx = (start[0] + end[0]) / 2
  const mz = (start[2] + end[2]) / 2
  const baseElev = (start[1] + end[1]) / 2
  const midY = 0.2

  return (
    <group>
      <mesh position={[center[0], baseElev + 0.05, center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[displayRadius - 0.15, displayRadius + 0.15, ringSegments]} />
        <meshBasicMaterial color='#ff8800' transparent opacity={0.2} depthWrite={false} side={2} />
      </mesh>

      <mesh position={[center[0], baseElev + 0.06, center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.6, 12]} />
        <meshBasicMaterial color='#ff8800' transparent opacity={0.5} side={2} />
      </mesh>

      <Text
        position={[mx, baseElev + midY + 1.5, mz]}
        fontSize={1.2}
        color='#ff8800'
        anchorX='center'
        anchorY='middle'
        outlineWidth={0.08}
        outlineColor='#000000'
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {`R ${radius.toFixed(1)}m`}
      </Text>
    </group>
  )
}
