import { useCarStore } from '../../../stores/useCarStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    padding: '20px 25px',
    textAlign: 'center',
    minWidth: 80,
  },
  gear: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ff6b6b',
    lineHeight: 1,
    textShadow: '0 0 10px rgba(255, 107, 107, 0.5)',
  },
  label: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    marginBottom: 5,
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

export default function GearIndicator() {
  const gear = useCarStore(state => state.gear)
  const displayGear = gearLabels[gear] ?? gear.toString()

  return (
    <div style={styles.container}>
      <div style={styles.label}>Gear</div>
      <div
        style={{
          ...styles.gear,
          color: gear === -1 ? '#ff9f43' : '#ff6b6b',
        }}
      >
        {displayGear}
      </div>
    </div>
  )
}
