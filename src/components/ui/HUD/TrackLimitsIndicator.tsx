import { useEffect, useRef } from 'react'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useTrackLimitsStore } from '../../../stores/useTrackLimitsStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'

export default function TrackLimitsIndicator() {
  const currentSurface = useSurfaceStore(s => s.currentSurface)
  const roadContactCount = useSurfaceStore(s => s.roadContactCount)
  const curbContactCount = useSurfaceStore(s => s.curbContactCount)
  const pitroadContactCount = useSurfaceStore(s => s.pitroadContactCount)
  const gravelContactCount = useSurfaceStore(s => s.gravelContactCount)

  const isLapTimingActive = useLapTimeStore(s => s.isActive)

  const isOffTrack = useTrackLimitsStore(s => s.isOffTrack)
  const violationCount = useTrackLimitsStore(s => s.violationCount)
  const setOffTrack = useTrackLimitsStore(s => s.setOffTrack)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastOffTrackRef = useRef(false)

  useEffect(() => {
    const isCurrentlyOffTrack =
      (currentSurface === 'grass' || currentSurface === 'gravel') &&
      roadContactCount === 0 &&
      curbContactCount === 0 &&
      pitroadContactCount === 0

    if (isCurrentlyOffTrack !== lastOffTrackRef.current) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const delay = isCurrentlyOffTrack ? 100 : 0
      debounceRef.current = setTimeout(() => {
        setOffTrack(isCurrentlyOffTrack)
        lastOffTrackRef.current = isCurrentlyOffTrack
      }, delay)
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    currentSurface,
    roadContactCount,
    curbContactCount,
    pitroadContactCount,
    gravelContactCount,
    setOffTrack,
  ])

  if (!isLapTimingActive || !isOffTrack) return null

  return (
    <div
      className='fixed inset-0 z-[100] pointer-events-none'
      style={{
        boxShadow: 'inset 0 0 0 3px rgba(255,204,0,0.85), inset 0 0 40px rgba(255,204,0,0.25)',
        animation: 'hud-pulse 0.55s ease-in-out infinite',
      }}
    >
      <div className='absolute top-[90px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1'>
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
            ×{violationCount}
          </span>
        )}
      </div>
    </div>
  )
}
