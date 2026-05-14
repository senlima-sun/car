interface ElevationGridProps {
  visible: boolean
}

export default function ElevationGrid({ visible }: ElevationGridProps) {
  if (!visible) return null

  return (
    <group>
      {[5, 10, 15, 20].map(y => (
        <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 100, 64]} />
          <meshBasicMaterial
            color='#3b82f6'
            transparent
            opacity={0.08}
            depthWrite={false}
            side={2}
          />
        </mesh>
      ))}
    </group>
  )
}
