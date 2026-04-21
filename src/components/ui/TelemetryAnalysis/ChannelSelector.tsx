import { CH, CHANNEL_META } from '../../../telemetry/channels'
import type { ChannelId } from '../../../telemetry/channels'

const DEFAULT_CHANNELS: ChannelId[] = [
  CH.SPEED_KMH,
  CH.THROTTLE,
  CH.BRAKE,
  CH.LATERAL_G,
  CH.LONGITUDINAL_G,
  CH.ERS_BATTERY,
]

const ALL_CHANNELS: ChannelId[] = Object.keys(CHANNEL_META)
  .map(Number)
  .filter(id => id !== CH.TIMESTAMP && id !== CH.DISTANCE) as ChannelId[]

interface ChannelSelectorProps {
  selected: ChannelId[]
  onChange: (channels: ChannelId[]) => void
}

export { DEFAULT_CHANNELS }

export default function ChannelSelector({ selected, onChange }: ChannelSelectorProps) {
  const toggle = (ch: ChannelId) => {
    if (selected.includes(ch)) {
      if (selected.length > 1) {
        onChange(selected.filter(c => c !== ch))
      }
    } else {
      onChange([...selected, ch])
    }
  }

  return (
    <div className='flex flex-wrap gap-1 p-2'>
      {ALL_CHANNELS.map(ch => {
        const meta = CHANNEL_META[ch]
        const active = selected.includes(ch)
        return (
          <button
            key={ch}
            onClick={() => toggle(ch)}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
              active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {meta.name}
          </button>
        )
      })}
    </div>
  )
}
