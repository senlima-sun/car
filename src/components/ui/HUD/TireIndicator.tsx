import { useTireStore } from '../../../stores/useTireStore'
import { TIRE_CONFIG, TIRE_WEAR_WARNING, TIRE_WEAR_CRITICAL } from '../../../constants/tires'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 100,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  compoundBadge: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: 18,
    color: '#000',
    border: '2px solid rgba(255, 255, 255, 0.3)',
  },
  compoundInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  compoundName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  gripLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
  },
  wearContainer: {
    width: '100%',
  },
  wearLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginBottom: 4,
  },
  wearBarBackground: {
    width: '100%',
    height: 8,
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  wearBar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
}

export default function TireIndicator() {
  const currentCompound = useTireStore(state => state.currentCompound)
  const wear = useTireStore(state => state.wear)
  const effectiveGrip = useTireStore(state => state.effectiveGripMultiplier)

  const config = TIRE_CONFIG[currentCompound]
  const wearPercent = Math.round(wear)
  const remainingLife = 100 - wearPercent
  const gripPercent = Math.round(effectiveGrip * 100)

  // Determine wear bar color based on level
  const getWearColor = () => {
    if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444' // Red
    if (wear >= TIRE_WEAR_WARNING) return '#f59e0b' // Orange/Amber
    return '#22c55e' // Green
  }

  // Flash animation for critical wear
  const isFlashing = wear >= TIRE_WEAR_CRITICAL

  return (
    <div
      style={{
        ...styles.container,
        animation: isFlashing ? 'pulse 1s ease-in-out infinite' : 'none',
      }}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}
      </style>

      {/* Compound badge and info */}
      <div style={styles.header}>
        <div
          style={{
            ...styles.compoundBadge,
            backgroundColor: config.color,
          }}
        >
          {config.icon}
        </div>
        <div style={styles.compoundInfo as React.CSSProperties}>
          <span style={styles.compoundName}>{config.displayName}</span>
          <span style={styles.gripLabel}>GRIP: {gripPercent}%</span>
        </div>
      </div>

      {/* Wear bar */}
      <div style={styles.wearContainer}>
        <div style={styles.wearLabel}>
          <span>TIRE LIFE</span>
          <span>{remainingLife}%</span>
        </div>
        <div style={styles.wearBarBackground}>
          <div
            style={{
              ...styles.wearBar,
              width: `${remainingLife}%`,
              backgroundColor: getWearColor(),
            }}
          />
        </div>
      </div>
    </div>
  )
}
