import { useTireStore } from '../../../stores/useTireStore'
import { TIRE_CONFIG, TIRE_WEAR_WARNING, TIRE_WEAR_CRITICAL } from '../../../constants/tires'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 160,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  compoundBadge: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000',
    border: '2px solid rgba(255, 255, 255, 0.3)',
  },
  compoundInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  compoundName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  gripLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
  },
  wheelsContainer: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  wheelColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  wheelIndicator: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 50,
  },
  wheelLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 2,
  },
  wheelBar: {
    width: 32,
    height: 56,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  wheelFill: {
    borderRadius: 4,
    transition: 'height 0.3s ease, background-color 0.3s ease',
  },
  wheelPercent: {
    fontSize: 9,
    color: '#fff',
    marginTop: 2,
    fontWeight: 'bold',
  },
  carBody: {
    width: 14,
    height: 52,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
  },
  avgContainer: {
    width: '100%',
  },
  avgLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    marginBottom: 3,
  },
  avgBarBackground: {
    width: '100%',
    height: 6,
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  avgBar: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
}

// Get color based on wear percentage
function getWearColor(wear: number): string {
  if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444' // Red
  if (wear >= TIRE_WEAR_WARNING) return '#f59e0b' // Orange/Amber
  return '#22c55e' // Green
}

// Single wheel indicator component
function WheelIndicator({ label, wear, compoundColor }: { label: string; wear: number; compoundColor: string }) {
  const remaining = Math.max(0, 100 - wear)
  const color = getWearColor(wear)

  return (
    <div style={styles.wheelIndicator}>
      <span style={styles.wheelLabel}>{label}</span>
      <div style={{
        ...styles.wheelBar,
        border: `3px solid ${compoundColor}`,
      }}>
        <div
          style={{
            ...styles.wheelFill,
            height: `${remaining}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span style={{ ...styles.wheelPercent, color }}>{Math.round(remaining)}%</span>
    </div>
  )
}

export default function TireIndicator() {
  const currentCompound = useTireStore(state => state.currentCompound)
  const perWheelWear = useTireStore(state => state.perWheelWear)
  const averageWear = useTireStore(state => state.averageWear)
  const effectiveGrip = useTireStore(state => state.effectiveGripMultiplier)

  const config = TIRE_CONFIG[currentCompound]
  const avgRemaining = Math.max(0, 100 - averageWear)
  const gripPercent = Math.round(effectiveGrip * 100)

  // Flash animation for critical wear on any wheel
  const maxWear = Math.max(
    perWheelWear.frontLeft,
    perWheelWear.frontRight,
    perWheelWear.rearLeft,
    perWheelWear.rearRight
  )
  const isFlashing = maxWear >= TIRE_WEAR_CRITICAL

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

      {/* 4-wheel display (car top-down view) */}
      <div style={styles.wheelsContainer}>
        {/* Left wheels */}
        <div style={styles.wheelColumn}>
          <WheelIndicator label="FL" wear={perWheelWear.frontLeft} compoundColor={config.color} />
          <WheelIndicator label="RL" wear={perWheelWear.rearLeft} compoundColor={config.color} />
        </div>

        {/* Car body silhouette */}
        <div style={styles.carBody} />

        {/* Right wheels */}
        <div style={styles.wheelColumn}>
          <WheelIndicator label="FR" wear={perWheelWear.frontRight} compoundColor={config.color} />
          <WheelIndicator label="RR" wear={perWheelWear.rearRight} compoundColor={config.color} />
        </div>
      </div>

      {/* Average wear bar */}
      <div style={styles.avgContainer}>
        <div style={styles.avgLabel}>
          <span>AVG TIRE LIFE</span>
          <span>{Math.round(avgRemaining)}%</span>
        </div>
        <div style={styles.avgBarBackground}>
          <div
            style={{
              ...styles.avgBar,
              width: `${avgRemaining}%`,
              backgroundColor: getWearColor(averageWear),
            }}
          />
        </div>
      </div>
    </div>
  )
}
