import { Text } from '@react-three/drei'

export function BarrierBlockedIndicator({
  startPoint,
  endPoint,
}: {
  startPoint: [number, number, number]
  endPoint: [number, number, number]
}) {
  const midX = (startPoint[0] + endPoint[0]) / 2
  const midZ = (startPoint[2] + endPoint[2]) / 2

  return (
    <group>
      <mesh position={[midX, 2.0, midZ]}>
        <sphereGeometry args={[1.0, 16, 16]} />
        <meshStandardMaterial
          color='#ff0000'
          transparent
          opacity={0.6}
          emissive='#ff0000'
          emissiveIntensity={0.5}
        />
      </mesh>
      <Text
        position={[midX, 3.5, midZ]}
        fontSize={1.5}
        color='#ff0000'
        anchorX='center'
        anchorY='middle'
        outlineWidth={0.1}
        outlineColor='#000000'
        rotation={[-Math.PI / 2, 0, 0]}
      >
        BLOCKED
      </Text>
    </group>
  )
}
