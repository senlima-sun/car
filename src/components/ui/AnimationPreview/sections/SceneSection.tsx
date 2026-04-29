import { useShowroomStore } from '@/stores/useShowroomStore'
import { Chip } from '../primitives/Chip'
import { ColorRow } from '../primitives/ColorRow'
import { Section } from '../primitives/Section'
import { Slider } from '../primitives/Slider'

export function SceneSection() {
  const s = useShowroomStore()
  return (
    <Section title='Scene'>
      <ColorRow label='Floor' value={s.floorColor} onChange={v => s.setField('floorColor', v)} />
      <ColorRow label='Ring' value={s.ringColor} onChange={v => s.setField('ringColor', v)} />
      <Slider
        label='Ring Opacity'
        value={s.ringOpacity}
        min={0}
        max={1}
        step={0.01}
        onChange={v => s.setField('ringOpacity', v)}
      />
      <Slider
        label='Ambient'
        value={s.ambientIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => s.setField('ambientIntensity', v)}
      />
      <div className='my-2 h-px bg-white/5' />
      <ColorRow
        label='Key'
        value={s.keyLightColor}
        onChange={v => s.setField('keyLightColor', v)}
      />
      <Slider
        label='Key Power'
        value={s.keyLightIntensity}
        min={0}
        max={6}
        step={0.1}
        onChange={v => s.setField('keyLightIntensity', v)}
      />
      <ColorRow
        label='Fill'
        value={s.fillLightColor}
        onChange={v => s.setField('fillLightColor', v)}
      />
      <Slider
        label='Fill Power'
        value={s.fillLightIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => s.setField('fillLightIntensity', v)}
      />
      <ColorRow
        label='Rim'
        value={s.rimLightColor}
        onChange={v => s.setField('rimLightColor', v)}
      />
      <Slider
        label='Rim Power'
        value={s.rimLightIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => s.setField('rimLightIntensity', v)}
      />
      <ColorRow
        label='Top'
        value={s.topLightColor}
        onChange={v => s.setField('topLightColor', v)}
      />
      <Slider
        label='Top Power'
        value={s.topLightIntensity}
        min={0}
        max={4}
        step={0.05}
        onChange={v => s.setField('topLightIntensity', v)}
      />
      <div className='my-2 h-px bg-white/5' />
      <ColorRow label='Sky' value={s.hemiSkyColor} onChange={v => s.setField('hemiSkyColor', v)} />
      <ColorRow
        label='Ground'
        value={s.hemiGroundColor}
        onChange={v => s.setField('hemiGroundColor', v)}
      />
      <Slider
        label='Hemi Power'
        value={s.hemiIntensity}
        min={0}
        max={3}
        step={0.05}
        onChange={v => s.setField('hemiIntensity', v)}
      />
      <div className='pt-2'>
        <Chip label='Reset scene' onClick={() => s.reset()} />
      </div>
    </Section>
  )
}
