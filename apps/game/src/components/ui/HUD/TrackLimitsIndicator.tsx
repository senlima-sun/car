import { useTrackLimitsStore } from '../../../stores/useTrackLimitsStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { AccentBar, Surface } from '../primitives'

export default function TrackLimitsIndicator() {
  const isLapTimingActive = useLapTimeStore(s => s.isActive)
  const isOffTrack = useTrackLimitsStore(s => s.isOffTrack)
  const violationCount = useTrackLimitsStore(s => s.violationCount)

  if (!isLapTimingActive || !isOffTrack) return null

  return (
    <div className='fixed top-[90px] left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-1 pointer-events-none'>
      <Surface variant='card' className='relative px-6 py-2'>
        <AccentBar color='#ffcc00' />
        <span
          className='font-sans text-[16px] font-bold uppercase tracking-[0.42em] pl-1'
          style={{ color: '#ffcc00', textShadow: '0 0 14px rgba(255,204,0,0.5)' }}
        >
          Track Limits
        </span>
      </Surface>
      {violationCount > 1 && (
        <span className='font-mono text-[11px] font-semibold tabular-nums text-[#ffcc00]/80'>
          x{violationCount}
        </span>
      )}
    </div>
  )
}
