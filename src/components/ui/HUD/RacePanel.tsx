import { useCarStore } from '../../../stores/useCarStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  gearBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 107, 107, 0.15)',
    border: '2px solid rgba(255, 107, 107, 0.4)',
  },
  gear: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff6b6b',
    lineHeight: 1,
    fontFamily: 'monospace',
  },
  speedSection: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
  },
  speed: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00ff88',
    lineHeight: 1,
    fontFamily: 'monospace',
    minWidth: 72,
    textAlign: 'right',
  },
  unit: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase' as const,
  },
}

const gearLabels: Record<number, string> = {
  [-1]: 'R',
  0: 'N',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
}

export default function RacePanel() {
  const gear = useCarStore(state => state.gear)
  const speed = useCarStore(state => state.speed)

  const displayGear = gearLabels[gear] ?? gear.toString()
  const displaySpeed = Math.round(Math.abs(speed))

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.gearBox,
          background: gear === -1 ? 'rgba(255, 159, 67, 0.15)' : 'rgba(255, 107, 107, 0.15)',
          borderColor: gear === -1 ? 'rgba(255, 159, 67, 0.4)' : 'rgba(255, 107, 107, 0.4)',
        }}
      >
        <span
          style={{
            ...styles.gear,
            color: gear === -1 ? '#ff9f43' : '#ff6b6b',
          }}
        >
          {displayGear}
        </span>
      </div>
      <div style={styles.speedSection}>
        <span style={styles.speed as React.CSSProperties}>{displaySpeed}</span>
        <span style={styles.unit}>km/h</span>
      </div>
    </div>
  )
}
