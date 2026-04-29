import { useShowroomStore } from '@/stores/useShowroomStore'
import { Chip } from '../primitives/Chip'
import { ColorRow } from '../primitives/ColorRow'
import { Section } from '../primitives/Section'
import { Slider } from '../primitives/Slider'

export function SceneSection() {
  const floorColor = useShowroomStore(s => s.floorColor)
  const ringColor = useShowroomStore(s => s.ringColor)
  const ringOpacity = useShowroomStore(s => s.ringOpacity)
  const ambientIntensity = useShowroomStore(s => s.ambientIntensity)
  const keyLightColor = useShowroomStore(s => s.keyLightColor)
  const keyLightIntensity = useShowroomStore(s => s.keyLightIntensity)
  const fillLightColor = useShowroomStore(s => s.fillLightColor)
  const fillLightIntensity = useShowroomStore(s => s.fillLightIntensity)
  const rimLightColor = useShowroomStore(s => s.rimLightColor)
  const rimLightIntensity = useShowroomStore(s => s.rimLightIntensity)
  const topLightColor = useShowroomStore(s => s.topLightColor)
  const topLightIntensity = useShowroomStore(s => s.topLightIntensity)
  const hemiSkyColor = useShowroomStore(s => s.hemiSkyColor)
  const hemiGroundColor = useShowroomStore(s => s.hemiGroundColor)
  const hemiIntensity = useShowroomStore(s => s.hemiIntensity)
  const setField = useShowroomStore(s => s.setField)
  const reset = useShowroomStore(s => s.reset)

  return (
    <Section title='Scene'>
      <ColorRow label='Floor' value={floorColor} onChange={v => setField('floorColor', v)} />
      <ColorRow label='Ring' value={ringColor} onChange={v => setField('ringColor', v)} />
      <Slider
        label='Ring Opacity'
        value={ringOpacity}
        min={0}
        max={1}
        step={0.01}
        onChange={v => setField('ringOpacity', v)}
      />
      <Slider
        label='Ambient'
        value={ambientIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => setField('ambientIntensity', v)}
      />
      <div className='my-2 h-px bg-white/5' />
      <ColorRow label='Key' value={keyLightColor} onChange={v => setField('keyLightColor', v)} />
      <Slider
        label='Key Power'
        value={keyLightIntensity}
        min={0}
        max={6}
        step={0.1}
        onChange={v => setField('keyLightIntensity', v)}
      />
      <ColorRow label='Fill' value={fillLightColor} onChange={v => setField('fillLightColor', v)} />
      <Slider
        label='Fill Power'
        value={fillLightIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => setField('fillLightIntensity', v)}
      />
      <ColorRow label='Rim' value={rimLightColor} onChange={v => setField('rimLightColor', v)} />
      <Slider
        label='Rim Power'
        value={rimLightIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => setField('rimLightIntensity', v)}
      />
      <ColorRow label='Top' value={topLightColor} onChange={v => setField('topLightColor', v)} />
      <Slider
        label='Top Power'
        value={topLightIntensity}
        min={0}
        max={4}
        step={0.05}
        onChange={v => setField('topLightIntensity', v)}
      />
      <div className='my-2 h-px bg-white/5' />
      <ColorRow label='Sky' value={hemiSkyColor} onChange={v => setField('hemiSkyColor', v)} />
      <ColorRow
        label='Ground'
        value={hemiGroundColor}
        onChange={v => setField('hemiGroundColor', v)}
      />
      <Slider
        label='Hemi Power'
        value={hemiIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => setField('hemiIntensity', v)}
      />
      <div className='pt-2'>
        <Chip label='Reset scene' onClick={reset} />
      </div>
    </Section>
  )
}
