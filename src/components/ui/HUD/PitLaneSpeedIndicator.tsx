import { usePitStore, PIT_LANE_SPEED_LIMIT_KMH } from '../../../stores/usePitStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { useCarStore } from '../../../stores/useCarStore'

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
      <div
        className='relative flex items-center gap-3 border bg-gradient-to-b from-black/85 to-black/70 px-4 py-2 backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.5)]'
        style={{
          borderColor: accent,
          clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
          animation: isPitLaneSpeeding ? 'hud-critical 0.5s ease-in-out infinite' : undefined,
        }}
      >
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
      </div>

      {isRecording && penalty > 0 && (
        <div
          className='border border-red-500/70 bg-red-900/70 px-3 py-1 font-mono text-[12px] font-bold tabular-nums text-white backdrop-blur-md'
          style={{
            clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)',
            animation: 'hud-fade-in 250ms ease-out',
          }}
        >
          +{penalty}s PENALTY
        </div>
      )}
    </div>
  )
}
