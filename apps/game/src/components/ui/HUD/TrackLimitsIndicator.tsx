import { useTrackLimitsStore } from '../../../stores/useTrackLimitsStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'

export default function TrackLimitsIndicator() {
  const isLapTimingActive = useLapTimeStore(s => s.isActive)
  const isOffTrack = useTrackLimitsStore(s => s.isOffTrack)
  const violationCount = useTrackLimitsStore(s => s.violationCount)

  if (!isLapTimingActive || !isOffTrack) return null

  return (
    <div className='fixed top-[90px] left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-1 pointer-events-none'>
      <div
        className='border border-[#ffcc00]/60 bg-black/70 px-6 py-2 backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.5)]'
        style={{
          clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
        }}
      >
        <span
          className='font-sans text-[16px] font-bold uppercase tracking-[0.42em]'
          style={{ color: '#ffcc00', textShadow: '0 0 14px rgba(255,204,0,0.5)' }}
        >
          Track Limits
        </span>
      </div>
      {violationCount > 1 && (
        <span className='font-mono text-[11px] font-semibold tabular-nums text-[#ffcc00]/80'>
          x{violationCount}
        </span>
      )}
    </div>
  )
}
