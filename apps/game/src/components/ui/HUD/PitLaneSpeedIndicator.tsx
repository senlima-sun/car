import { usePitStore, PIT_LANE_SPEED_LIMIT_KMH } from '../../../stores/usePitStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { useCarStore } from '../../../stores/useCarStore'
import { AccentBar, Surface } from '../primitives'

export default function PitLaneSpeedIndicator() {
  const isInPitLane = usePitStore(s => s.isInPitLane)
  const isPitLaneSpeeding = usePitStore(s => s.isPitLaneSpeeding)
  const penalty = usePitStore(s => s.pitLaneSpeedingPenalty)
  const isRecording = useLapTimeStore(s => s.isRecording)
  const speed = useCarStore(s => s.speed)

  if (!isInPitLane) return null

  const accent = isPitLaneSpeeding ? '#ef4444' : '#ffcc00'
  const speedRounded = Math.round(speed)

  return (
    <div className='fixed top-[140px] left-1/2 z-[101] -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none'>
      <Surface
        variant='card'
        className='relative flex items-center gap-3 px-4 py-2'
        style={{
          animation: isPitLaneSpeeding ? 'hud-critical 0.5s ease-in-out infinite' : undefined,
        }}
      >
        <AccentBar color={accent} />
        <div
          className='flex h-8 w-8 items-center justify-center rounded-full border-[2.5px] font-mono text-[11px] font-bold tabular-nums'
          style={{
            borderColor: accent,
            color: accent,
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          {PIT_LANE_SPEED_LIMIT_KMH}
        </div>
        <div className='flex flex-col'>
          <span
            className='text-[8px] font-bold uppercase tracking-[0.32em]'
            style={{ color: accent }}
          >
            Pit Lane
          </span>
          <span className='font-mono text-[14px] font-semibold tabular-nums text-white'>
            {speedRounded}
            <span className='ml-0.5 text-[10px] text-white/45'>km/h</span>
          </span>
        </div>
      </Surface>

      {isRecording && penalty > 0 && (
        <Surface
          variant='card'
          className='relative px-3 py-1 font-mono text-[12px] font-bold tabular-nums text-white'
          style={{
            borderColor: 'rgba(239,68,68,0.7)',
            background: 'rgba(90,15,15,0.7)',
            animation: 'hud-fade-in 250ms ease-out',
          }}
        >
          <AccentBar color='#ef4444' />
          <span className='pl-1'>+{penalty}s PENALTY</span>
        </Surface>
      )}
    </div>
  )
}
