interface CockpitProps {
  steerAngle: number
  showDisplay: boolean
}

export function Cockpit({ showDisplay }: CockpitProps) {
  if (!showDisplay) return null
  return (
    <group>
      <pointLight position={[0, 0.55, 3.2]} intensity={8} distance={3} color='#e8e0f0' decay={2} />
      <pointLight position={[0, 0.25, 2.39]} intensity={4} distance={1.5} color='#ffffff' decay={2} />
    </group>
  )
}
