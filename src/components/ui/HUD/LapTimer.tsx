import { useEffect } from 'react'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: '12px 20px',
    display: 'flex',
    gap: 25,
    alignItems: 'center',
  },
  hint: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    padding: '8px 16px',
    color: '#888',
    fontSize: 12,
  },
  timeBlock: {
    textAlign: 'center' as const,
  },
  label: {
    fontSize: 10,
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 2,
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    color: '#ff4444',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#ff4444',
    animation: 'pulse 1s infinite',
  },
  currentTime: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00ff88',
    fontFamily: 'monospace',
    textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
  },
  lastTime: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  bestTime: {
    fontSize: 16,
    color: '#ff00ff',
    fontFamily: 'monospace',
    textShadow: '0 0 8px rgba(255, 0, 255, 0.5)',
  },
  lapCount: {
    fontSize: 14,
    color: '#aaa',
    fontFamily: 'monospace',
  },
  waiting: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic' as const,
  },
}

function formatTime(ms: number | null): string {
  if (ms === null) return '--:--.---'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export default function LapTimer() {
  const isActive = useLapTimeStore(state => state.isActive)
  const isRecording = useLapTimeStore(state => state.isRecording)
  const currentLapStart = useLapTimeStore(state => state.currentLapStart)
  const currentLapTime = useLapTimeStore(state => state.currentLapTime)
  const lastLapTime = useLapTimeStore(state => state.lastLapTime)
  const bestLapTime = useLapTimeStore(state => state.bestLapTime)
  const lapCount = useLapTimeStore(state => state.lapCount)
  const updateCurrentTime = useLapTimeStore(state => state.updateCurrentTime)

  // Update current lap time every frame
  useEffect(() => {
    if (!isActive || !isRecording || currentLapStart === null) return

    let animationId: number
    const update = () => {
      updateCurrentTime()
      animationId = requestAnimationFrame(update)
    }
    animationId = requestAnimationFrame(update)

    return () => cancelAnimationFrame(animationId)
  }, [isActive, isRecording, currentLapStart, updateCurrentTime])

  // Don't render if no checkpoints exist
  if (!isActive) return null

  // Show hint when not recording
  if (!isRecording) {
    return (
      <div style={styles.hint}>
        Press <strong>R</strong> to start lap timing
      </div>
    )
  }

  const hasStarted = currentLapStart !== null

  return (
    <div style={styles.container}>
      {/* Recording indicator */}
      <div style={styles.recordingIndicator}>
        <div style={styles.recordingDot} />
        REC
      </div>

      {/* Current Lap */}
      <div style={styles.timeBlock}>
        <div style={styles.label}>Current</div>
        {hasStarted ? (
          <div style={styles.currentTime}>{formatTime(currentLapTime)}</div>
        ) : (
          <div style={styles.waiting}>Cross checkpoint</div>
        )}
      </div>

      {/* Last Lap */}
      <div style={styles.timeBlock}>
        <div style={styles.label}>Last</div>
        <div style={styles.lastTime}>{formatTime(lastLapTime)}</div>
      </div>

      {/* Best Lap */}
      <div style={styles.timeBlock}>
        <div style={styles.label}>Best</div>
        <div style={styles.bestTime}>{formatTime(bestLapTime)}</div>
      </div>

      {/* Lap Count */}
      <div style={styles.timeBlock}>
        <div style={styles.label}>Lap</div>
        <div style={styles.lapCount}>{lapCount}</div>
      </div>
    </div>
  )
}
