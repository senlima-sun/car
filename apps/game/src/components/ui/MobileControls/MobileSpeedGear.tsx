import { useCarStore } from '../../../stores/useCarStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 70,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '8px 16px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    pointerEvents: 'none',
  },
  speedValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00ff88',
    lineHeight: 1,
    textShadow: '0 0 8px rgba(0, 255, 136, 0.4)',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  unit: {
    fontSize: 12,
    color: '#888',
    marginLeft: 2,
  },
  gear: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ff6b6b',
    lineHeight: 1,
    background: 'rgba(255, 107, 107, 0.15)',
    padding: '4px 10px',
    borderRadius: 6,
    minWidth: 32,
    textAlign: 'center',
    textShadow: '0 0 6px rgba(255, 107, 107, 0.4)',
  },
  gearReverse: {
    color: '#ff9f43',
    background: 'rgba(255, 159, 67, 0.15)',
  },
}

function getGearLabel(gear: number): string {
  if (gear === -1) return 'R'
  if (gear === 0) return 'N'
  return gear.toString()
}

export default function MobileSpeedGear() {
  const speed = useCarStore(state => state.speed)
  const gear = useCarStore(state => state.gear)

  const displaySpeed = Math.round(Math.abs(speed))
  const gearLabel = getGearLabel(gear)
  const isReverse = gear === -1

  return (
    <div style={styles.container}>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span style={styles.speedValue}>{displaySpeed}</span>
        <span style={styles.unit}>km/h</span>
      </div>
      <span
        style={{
          ...styles.gear,
          ...(isReverse ? styles.gearReverse : {}),
        }}
      >
        {gearLabel}
      </span>
    </div>
  )
}
