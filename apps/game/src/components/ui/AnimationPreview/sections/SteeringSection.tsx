import { useCarStore } from '@/stores/useCarStore'
import { Chip } from '../primitives/Chip'
import { Section } from '../primitives/Section'
import { Slider } from '../primitives/Slider'

export function SteeringSection() {
  const steerAngle = useCarStore(s => s.steerAngle)
  const setSteer = (v: number) => useCarStore.getState().updateTelemetry({ steerAngle: v })
  const presetLockLeft = () => useCarStore.getState().updateTelemetry({ steerAngle: -0.6 })
  const presetLockRight = () => useCarStore.getState().updateTelemetry({ steerAngle: 0.6 })

  return (
    <Section title='Steering'>
      <Slider label='Angle' value={steerAngle} min={-0.6} max={0.6} step={0.01} onChange={setSteer} />
      <div className='flex flex-wrap gap-1.5 pt-1'>
        <Chip label='Left' onClick={presetLockLeft} active={steerAngle === -0.6} />
        <Chip label='Center' onClick={() => setSteer(0)} active={steerAngle === 0} />
        <Chip label='Right' onClick={presetLockRight} active={steerAngle === 0.6} />
      </div>
    </Section>
  )
}
