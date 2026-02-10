import { useEffect, useRef } from 'react'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useTrackLimitsStore } from '../../../stores/useTrackLimitsStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { TRACK_LIMITS } from '@/constants/colors'

const styles: Record<string, React.CSSProperties> = {
  // Full screen overlay with red border
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 100,
    boxSizing: 'border-box',
  },
  // Central warning text
  warningContainer: {
    position: 'absolute',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  warningText: {
    color: TRACK_LIMITS.warningText,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    textShadow: `0 0 10px ${TRACK_LIMITS.warningBorder}, 0 2px 4px rgba(0, 0, 0, 0.8)`,
    letterSpacing: 4,
  },
  violationCount: {
    color: TRACK_LIMITS.warningText,
    fontSize: 12,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    opacity: 0.8,
  },
}

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

  // Track previous state to avoid rapid flickering
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastOffTrackRef = useRef(false)

  // Determine if car is off track
  // Off track = on grass AND not touching any road or curb
  useEffect(() => {
    const isCurrentlyOffTrack =
      (currentSurface === 'grass' || currentSurface === 'gravel') &&
      roadContactCount === 0 &&
      curbContactCount === 0 &&
      pitroadContactCount === 0

    // Debounce to prevent rapid flickering when on track edges
    if (isCurrentlyOffTrack !== lastOffTrackRef.current) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Small delay before registering off-track (prevents micro-violations)
      const delay = isCurrentlyOffTrack ? 100 : 0

      debounceRef.current = setTimeout(() => {
        setOffTrack(isCurrentlyOffTrack)
        lastOffTrackRef.current = isCurrentlyOffTrack
      }, delay)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [currentSurface, roadContactCount, curbContactCount, pitroadContactCount, gravelContactCount, setOffTrack])

  if (!isLapTimingActive || !isOffTrack) {
    return null
  }

  return (
    <div
      style={{
        ...styles.overlay,
        border: `4px solid ${TRACK_LIMITS.warningBorder}`,
        animation: 'trackLimitsPulse 0.5s ease-in-out infinite',
      }}
    >
      <style>
        {`
          @keyframes trackLimitsPulse {
            0%, 100% {
              border-color: ${TRACK_LIMITS.warningBorder};
              box-shadow: inset 0 0 30px ${TRACK_LIMITS.warningGlow};
            }
            50% {
              border-color: transparent;
              box-shadow: none;
            }
          }
        `}
      </style>

      <div style={styles.warningContainer}>
        <div style={styles.warningText}>TRACK LIMITS</div>
        {violationCount > 1 && (
          <div style={styles.violationCount}>×{violationCount}</div>
        )}
      </div>
    </div>
  )
}
