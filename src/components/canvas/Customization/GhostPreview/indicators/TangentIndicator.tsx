export function TangentIndicator({
  origin,
  direction,
}: {
  origin: [number, number, number]
  direction: [number, number, number]
}) {
  const arrowLength = 8
  const arrowHeadLength = 1.5

  const endX = origin[0] + direction[0] * arrowLength
  const endZ = origin[2] + direction[2] * arrowLength

  const shaftLength = arrowLength - arrowHeadLength
  const shaftMidX = origin[0] + direction[0] * (shaftLength / 2)
  const shaftMidZ = origin[2] + direction[2] * (shaftLength / 2)

  const angle = Math.atan2(direction[0], direction[2])
  const originY = origin[1] ?? 0

  return (
    <group>
      <mesh position={[shaftMidX, originY + 0.1, shaftMidZ]} rotation={[-Math.PI / 2, 0, -angle]}>
        <planeGeometry args={[0.2, shaftLength]} />
        <meshBasicMaterial color='#ffaa00' transparent opacity={0.7} depthWrite={false} />
      </mesh>

      <mesh position={[endX, originY + 0.1, endZ]} rotation={[-Math.PI / 2, 0, -angle]}>
        <coneGeometry args={[0.5, arrowHeadLength, 3]} />
        <meshBasicMaterial color='#ffaa00' transparent opacity={0.8} />
      </mesh>
    </group>
  )
}
