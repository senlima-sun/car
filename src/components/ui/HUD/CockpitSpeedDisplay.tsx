import { useCarStore } from '../../../stores/useCarStore'
import { useGameStore } from '../../../stores/useGameStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '12px 24px',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  speedValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#00ff88',
    lineHeight: 1,
    textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  unit: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
}

export default function CockpitSpeedDisplay() {
  const cameraMode = useGameStore(state => state.cameraMode)
  const speed = useCarStore(state => state.speed)

  // Only render in first-person mode
  if (cameraMode === 'first-person') {
    return null
  }

  const displaySpeed = Math.round(Math.abs(speed))

  return (
    <div style={styles.container}>
      <span style={styles.speedValue}>{displaySpeed}</span>
      <span style={styles.unit}>km/h</span>
    </div>
  )
}
