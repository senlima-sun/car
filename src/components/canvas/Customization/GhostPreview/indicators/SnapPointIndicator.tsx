import type { SnapPointWithDirection } from '@/stores/useCustomizationStore'

export function SnapPointIndicator({
  point,
  isActive,
}: {
  point: SnapPointWithDirection
  isActive: boolean
}) {
  return (
    <mesh position={[point.position[0], point.position[1] + 0.15, point.position[2]]}>
      <ringGeometry args={[0.4, 0.6, 16]} />
      <meshBasicMaterial
        color={isActive ? '#00ffff' : '#888888'}
        transparent
        opacity={isActive ? 0.9 : 0.4}
        side={2}
      />
    </mesh>
  )
}
