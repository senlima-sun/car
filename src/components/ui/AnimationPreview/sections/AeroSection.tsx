import { useActiveAeroStore } from '@/stores/useActiveAeroStore'
import { Chip } from '../primitives/Chip'
import { Section } from '../primitives/Section'
import { Slider } from '../primitives/Slider'

export function AeroSection() {
  const frontWingAngle = useActiveAeroStore(s => s.frontWingAngle)
  const rearWingAngle = useActiveAeroStore(s => s.rearWingAngle)

  const setFrontWing = (v: number) => useActiveAeroStore.setState({ frontWingAngle: v })
  const setRearWing = (v: number) => useActiveAeroStore.setState({ rearWingAngle: v })
  const presetCorner = () => useActiveAeroStore.setState({ frontWingAngle: 1, rearWingAngle: 1 })
  const presetStraight = () => useActiveAeroStore.setState({ frontWingAngle: 0, rearWingAngle: 0 })

  const isCorner = frontWingAngle === 1 && rearWingAngle === 1
  const isStraight = frontWingAngle === 0 && rearWingAngle === 0

  return (
    <Section title='Aero'>
      <Slider
        label='Front Wing'
        value={frontWingAngle}
        min={0}
        max={1}
        step={0.01}
        onChange={setFrontWing}
      />
      <Slider
        label='Rear Wing'
        value={rearWingAngle}
        min={0}
        max={1}
        step={0.01}
        onChange={setRearWing}
      />
      <div className='flex flex-wrap gap-1.5 pt-1'>
        <Chip label='Corner' onClick={presetCorner} active={isCorner} />
        <Chip label='Straight' onClick={presetStraight} active={isStraight} />
      </div>
    </Section>
  )
}
