import { useTireStore } from '../../../stores/useTireStore'
import {
  useTemperatureStore,
  ENGINE_TEMP_CRITICAL,
  TIRE_TEMP_COLD,
  TIRE_TEMP_CRITICAL,
} from '../../../stores/useTemperatureStore'
import { TIRE_CONFIG, TIRE_WEAR_WARNING, TIRE_WEAR_CRITICAL } from '../../../constants/tires'
import { engineTempToCelsius, tireTempToCelsius } from '../../../wasm/PhysicsBridge'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 10,
    padding: '8px 12px',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    fontSize: 11,
  },
  // Tire compound section
  compound: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  compoundBadge: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: 12,
    color: '#000',
  },
  compoundLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    textTransform: 'uppercase' as const,
  },
  separator: {
    width: 1,
    height: 28,
    background: 'rgba(255, 255, 255, 0.15)',
  },
  // Tire life section
  tireLife: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 80,
  },
  tireLifeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tireLifeLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
  },
  tireLifeValue: {
    fontWeight: 'bold',
    fontSize: 11,
  },
  tireLifeBar: {
    height: 4,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  tireLifeFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  // Temperature section
  temps: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  tempItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  tempLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8,
    textTransform: 'uppercase' as const,
  },
  tempValue: {
    fontWeight: 'bold',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  // Grip indicator
  grip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  gripLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 8,
    textTransform: 'uppercase' as const,
  },
  gripValue: {
    fontWeight: 'bold',
    fontSize: 11,
    color: '#00ff88',
  },
}

function getWearColor(wear: number): string {
  if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444'
  if (wear >= TIRE_WEAR_WARNING) return '#f59e0b'
  return '#22c55e'
}

function getTempColor(normalized: number, isTire: boolean = false): string {
  if (isTire) {
    if (normalized < TIRE_TEMP_COLD) return '#3b82f6'
    if (normalized > TIRE_TEMP_CRITICAL) return '#ef4444'
    return '#22c55e'
  }
  if (normalized >= ENGINE_TEMP_CRITICAL) return '#ef4444'
  if (normalized >= 0.75) return '#f59e0b'
  if (normalized >= 0.4) return '#22c55e'
  return '#3b82f6'
}

export default function StatsPanel() {
  const currentCompound = useTireStore(state => state.currentCompound)
  const averageWear = useTireStore(state => state.averageWear)
  const effectiveGrip = useTireStore(state => state.effectiveGripMultiplier)
  const perWheelWear = useTireStore(state => state.perWheelWear)

  const engine = useTemperatureStore(state => state.engine)
  const tires = useTemperatureStore(state => state.tires)

  const config = TIRE_CONFIG[currentCompound]
  const tireLife = Math.max(0, 100 - averageWear)
  const gripPercent = Math.round(effectiveGrip * 100)

  // Calculate average tire temp
  const avgTireTemp =
    (tires.front_left_inner +
      tires.front_left_outer +
      tires.front_right_inner +
      tires.front_right_outer +
      tires.rear_left_inner +
      tires.rear_left_outer +
      tires.rear_right_inner +
      tires.rear_right_outer) /
    8

  const engineTempC = Math.round(engineTempToCelsius(engine.temperature))
  const tireTempC = Math.round(tireTempToCelsius(avgTireTemp))

  // Check for critical wear on any wheel
  const maxWear = Math.max(
    perWheelWear.frontLeft,
    perWheelWear.frontRight,
    perWheelWear.rearLeft,
    perWheelWear.rearRight,
  )
  const isCritical = maxWear >= TIRE_WEAR_CRITICAL

  return (
    <div
      style={{
        ...styles.container,
        animation: isCritical ? 'pulse 1s ease-in-out infinite' : 'none',
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

      {/* Tire compound badge */}
      <div style={styles.compound}>
        <div style={{ ...styles.compoundBadge, backgroundColor: config.color }}>{config.icon}</div>
        <span style={styles.compoundLabel}>{config.displayName.slice(0, 3)}</span>
      </div>

      <div style={styles.separator} />

      {/* Tire life bar */}
      <div style={styles.tireLife as React.CSSProperties}>
        <div style={styles.tireLifeHeader}>
          <span style={styles.tireLifeLabel}>Tire</span>
          <span style={{ ...styles.tireLifeValue, color: getWearColor(averageWear) }}>
            {Math.round(tireLife)}%
          </span>
        </div>
        <div style={styles.tireLifeBar}>
          <div
            style={{
              ...styles.tireLifeFill,
              width: `${tireLife}%`,
              backgroundColor: getWearColor(averageWear),
            }}
          />
        </div>
      </div>

      <div style={styles.separator} />

      {/* Temperatures */}
      <div style={styles.temps}>
        <div style={styles.tempItem as React.CSSProperties}>
          <span style={styles.tempLabel}>Eng</span>
          <span style={{ ...styles.tempValue, color: getTempColor(engine.temperature) }}>
            {engineTempC}
          </span>
        </div>
        <div style={styles.tempItem as React.CSSProperties}>
          <span style={styles.tempLabel}>Tire</span>
          <span style={{ ...styles.tempValue, color: getTempColor(avgTireTemp, true) }}>
            {tireTempC}
          </span>
        </div>
      </div>

      <div style={styles.separator} />

      {/* Grip */}
      <div style={styles.grip as React.CSSProperties}>
        <span style={styles.gripLabel}>Grip</span>
        <span
          style={{
            ...styles.gripValue,
            color: gripPercent >= 80 ? '#22c55e' : gripPercent >= 50 ? '#f59e0b' : '#ef4444',
          }}
        >
          {gripPercent}%
        </span>
      </div>
    </div>
  )
}
