export function ControlPointGuideLine({
  start,
  end,
}: {
  start: [number, number, number]
  end: [number, number, number]
}) {
  const midX = (start[0] + end[0]) / 2
  const midZ = (start[2] + end[2]) / 2
  const midY = (start[1] + end[1]) / 2
  const dx = end[0] - start[0]
  const dz = end[2] - start[2]
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)

  if (length < 0.1) return null

  return (
    <mesh position={[midX, midY + 0.04, midZ]} rotation={[-Math.PI / 2, 0, -angle]}>
      <planeGeometry args={[0.1, length]} />
      <meshBasicMaterial color='#ffff00' transparent opacity={0.4} depthWrite={false} />
    </mesh>
  )
}
