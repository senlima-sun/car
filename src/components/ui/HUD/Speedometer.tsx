import { useCarStore } from '../../../stores/useCarStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    padding: '20px 30px',
    textAlign: 'center',
    minWidth: 150,
  },
  speed: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#00ff88',
    lineHeight: 1,
    textShadow: '0 0 10px rgba(0, 255, 136, 0.5)',
  },
  unit: {
    fontSize: 16,
    color: '#aaa',
    marginTop: 5,
  },
  label: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    marginBottom: 5,
  },
}

export default function Speedometer() {
  const speed = useCarStore(state => state.speed)
  const displaySpeed = Math.round(speed)

  return (
    <div style={styles.container}>
      <div style={styles.label}>Speed</div>
      <div style={styles.speed}>{displaySpeed}</div>
      <div style={styles.unit}>km/h</div>
    </div>
  )
}
