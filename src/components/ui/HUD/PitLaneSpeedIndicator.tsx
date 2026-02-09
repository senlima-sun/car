import { usePitStore, PIT_LANE_SPEED_LIMIT_KMH } from '../../../stores/usePitStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { useCarStore } from '../../../stores/useCarStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 140,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    pointerEvents: 'none',
    zIndex: 101,
  },
  speedLimit: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    border: '2px solid rgba(255, 255, 255, 0.3)',
  },
  speedLimitSpeeding: {
    border: '2px solid #ef4444',
    background: 'rgba(239, 68, 68, 0.2)',
  },
  limitIcon: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '2px solid #ef4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  limitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  penaltyBadge: {
    padding: '4px 12px',
    background: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    animation: 'penaltyFlash 0.6s ease-in-out',
  },
}

export default function PitLaneSpeedIndicator() {
  const isInPitLane = usePitStore(s => s.isInPitLane)
  const isPitLaneSpeeding = usePitStore(s => s.isPitLaneSpeeding)
  const penalty = usePitStore(s => s.pitLaneSpeedingPenalty)
  const isRecording = useLapTimeStore(s => s.isRecording)
  const speed = useCarStore(s => s.speed)

  if (!isInPitLane) return null

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes penaltyFlash {
            0% { transform: scale(1.3); }
            100% { transform: scale(1); }
          }
        `}
      </style>

      <div
        style={{
          ...styles.speedLimit,
          ...(isPitLaneSpeeding ? styles.speedLimitSpeeding : {}),
        }}
      >
        <div style={styles.limitIcon}>{PIT_LANE_SPEED_LIMIT_KMH}</div>
        <div style={styles.limitText}>
          PIT LANE — {Math.round(speed)} km/h
        </div>
      </div>

      {isRecording && penalty > 0 && (
        <div style={styles.penaltyBadge}>+{penalty}s PENALTY</div>
      )}
    </div>
  )
}
