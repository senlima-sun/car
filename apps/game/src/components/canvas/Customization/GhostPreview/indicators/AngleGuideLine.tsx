export function AngleGuideLine({
  startPoint,
  angle,
  length,
  isActive,
}: {
  startPoint: [number, number, number]
  angle: number
  length: number
  isActive: boolean
}) {
  const endX = startPoint[0] + Math.sin(angle) * length
  const endZ = startPoint[2] + Math.cos(angle) * length

  const midX = (startPoint[0] + endX) / 2
  const midZ = (startPoint[2] + endZ) / 2
  const midY = startPoint[1] ?? 0

  return (
    <mesh position={[midX, midY + 0.02, midZ]} rotation={[-Math.PI / 2, 0, -angle]}>
      <planeGeometry args={[0.08, length]} />
      <meshBasicMaterial
        color={isActive ? '#00ffff' : '#666666'}
        transparent
        opacity={isActive ? 0.8 : 0.25}
        depthWrite={false}
      />
    </mesh>
  )
}
