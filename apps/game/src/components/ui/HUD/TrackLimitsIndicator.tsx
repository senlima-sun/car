import { useEffect, useRef } from 'react'
import { useCarStore } from '../../../stores/useCarStore'
import { useSurfaceStore, type SurfaceType } from '../../../stores/useSurfaceStore'
import { useSuspensionStore } from '../../../stores/useSuspensionStore'
import { useTrackLimitsStore } from '../../../stores/useTrackLimitsStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'

const TRACK_LIMITS_MIN_SPEED_KMH = 3
const TRACK_LIMITS_MIN_GROUNDED_WHEELS = 2
const TRACK_LIMITS_REQUIRED_OFF_TRACK_FRAMES = 4

export function isTrackLimitsOffTrack({
  speedKmh,
  currentSurface,
  roadContactCount,
  curbContactCount,
  pitroadContactCount,
  groundedCount,
}: {
  speedKmh: number
  currentSurface: SurfaceType
  roadContactCount: number
  curbContactCount: number
  pitroadContactCount: number
  groundedCount: number
}) {
  return (
    Math.abs(speedKmh) >= TRACK_LIMITS_MIN_SPEED_KMH &&
    groundedCount >= TRACK_LIMITS_MIN_GROUNDED_WHEELS &&
    (currentSurface === 'grass' ||
      currentSurface === 'gravel' ||
      currentSurface === 'painted_area') &&
    roadContactCount === 0 &&
    curbContactCount === 0 &&
    pitroadContactCount === 0
  )
}

export function getStableTrackLimitsOffTrack(
  isCurrentlyOffTrack: boolean,
  consecutiveOffTrackFrames: number,
  requiredOffTrackFrames = TRACK_LIMITS_REQUIRED_OFF_TRACK_FRAMES,
) {
  return isCurrentlyOffTrack && consecutiveOffTrackFrames >= requiredOffTrackFrames
}

export default function TrackLimitsIndicator() {
  const speedKmh = useCarStore(s => s.speed)
  const currentSurface = useSurfaceStore(s => s.currentSurface)
  const roadContactCount = useSurfaceStore(s => s.roadContactCount)
  const curbContactCount = useSurfaceStore(s => s.curbContactCount)
  const pitroadContactCount = useSurfaceStore(s => s.pitroadContactCount)
  const groundedCount = useSuspensionStore(s => s.groundedCount)

  const isLapTimingActive = useLapTimeStore(s => s.isActive)

  const isOffTrack = useTrackLimitsStore(s => s.isOffTrack)
  const violationCount = useTrackLimitsStore(s => s.violationCount)
  const setOffTrack = useTrackLimitsStore(s => s.setOffTrack)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastOffTrackRef = useRef(false)
  const offTrackFramesRef = useRef(0)

  useEffect(() => {
    const isCurrentlyOffTrack = isTrackLimitsOffTrack({
      speedKmh,
      currentSurface,
      roadContactCount,
      curbContactCount,
      pitroadContactCount,
      groundedCount,
    })

    offTrackFramesRef.current = isCurrentlyOffTrack ? offTrackFramesRef.current + 1 : 0

    const stableOffTrack = getStableTrackLimitsOffTrack(
      isCurrentlyOffTrack,
      offTrackFramesRef.current,
    )

    if (stableOffTrack !== lastOffTrackRef.current) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const delay = stableOffTrack ? 100 : 0
      debounceRef.current = setTimeout(() => {
        setOffTrack(stableOffTrack)
        lastOffTrackRef.current = stableOffTrack
      }, delay)
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [
    speedKmh,
    currentSurface,
    roadContactCount,
    curbContactCount,
    pitroadContactCount,
    groundedCount,
    setOffTrack,
  ])

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
