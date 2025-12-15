import { useFPSStore } from '../../../stores/useFPSStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    right: 20,
    background: 'rgba(0, 0, 0, 0.6)',
    padding: '8px 12px',
    borderRadius: 6,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
  },
}

function getFPSColor(fps: number): string {
  if (fps >= 50) return '#4ade80' // green
  if (fps >= 30) return '#facc15' // yellow
  return '#f87171' // red
}

export default function FPSCounter() {
  const fps = useFPSStore(state => state.fps)
  const color = getFPSColor(fps)

  return (
    <div style={styles.container}>
      <span style={{ color, opacity: 0.9 }}>{fps}</span>
      <span style={{ color: '#888', marginLeft: 4 }}>FPS</span>
    </div>
  )
}
