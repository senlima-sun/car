import { useTemperatureStore } from '../../../stores/useTemperatureStore'
import {
  engineTempToCelsius,
  tireTempToCelsius,
} from '../../../wasm/PhysicsBridge'
import { celsiusToColor } from '../../../utils/temperatureColors'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minWidth: 160,
  },
  header: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    paddingBottom: 6,
  },
  engineSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  engineLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  engineBar: {
    height: 8,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  engineFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.2s, background-color 0.3s',
  },
  tiresSection: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  tireColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  tireWheel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  tireLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tireBar: {
    width: 20,
    height: 36,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 3,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  tireHalf: {
    flex: 1,
    transition: 'background-color 0.3s',
  },
  tireTemp: {
    fontSize: 8,
    color: '#fff',
    marginTop: 2,
  },
  carBody: {
    width: 10,
    height: 32,
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 6,
  },
  powerLoss: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}

function getTempColor(normalized: number, type: 'tire' | 'engine'): string {
  const celsius =
    type === 'tire'
      ? tireTempToCelsius(normalized)
      : engineTempToCelsius(normalized)
  return celsiusToColor(celsius)
}

function TireDisplay({
  label,
  inner,
  outer,
  inWindow,
}: {
  label: string
  inner: number
  outer: number
  inWindow: boolean
}) {
  const avg = (inner + outer) / 2
  const tempC = Math.round(tireTempToCelsius(avg))

  return (
    <div style={styles.tireWheel}>
      <span style={styles.tireLabel}>{label}</span>
      <div
        style={{
          ...styles.tireBar,
          boxShadow: inWindow ? '0 0 4px #22c55e' : 'none',
        }}
      >
        {/* Outer edge (top) */}
        <div
          style={{
            ...styles.tireHalf,
            backgroundColor: getTempColor(outer, 'tire'),
          }}
        />
        {/* Inner edge (bottom) */}
        <div
          style={{
            ...styles.tireHalf,
            backgroundColor: getTempColor(inner, 'tire'),
          }}
        />
      </div>
      <span style={styles.tireTemp}>{tempC}C</span>
    </div>
  )
}

export default function TemperaturePanel() {
  const engine = useTemperatureStore((state) => state.engine)
  const tires = useTemperatureStore((state) => state.tires)
  const tiresInWindow = useTemperatureStore((state) => state.tiresInWindow)

  const engineTempC = Math.round(engineTempToCelsius(engine.temperature))
  const powerLoss = Math.round((1 - engine.power_multiplier) * 100)

  return (
    <div style={styles.container}>
      <div style={styles.header}>TEMPERATURES</div>

      {/* Engine temperature */}
      <div style={styles.engineSection as React.CSSProperties}>
        <div style={styles.engineLabel}>
          <span>ENGINE</span>
          <span style={{ color: getTempColor(engine.temperature, 'engine') }}>
            {engineTempC}C
          </span>
        </div>
        <div style={styles.engineBar}>
          <div
            style={{
              ...styles.engineFill,
              width: `${engine.temperature * 100}%`,
              backgroundColor: getTempColor(engine.temperature, 'engine'),
            }}
          />
        </div>
        {powerLoss > 0 && (
          <div style={styles.powerLoss as React.CSSProperties}>
            -{powerLoss}% POWER
          </div>
        )}
      </div>

      {/* Tire temperatures */}
      <div style={styles.tiresSection}>
        {/* Left side */}
        <div style={styles.tireColumn as React.CSSProperties}>
          <TireDisplay
            label="FL"
            inner={tires.front_left_inner}
            outer={tires.front_left_outer}
            inWindow={tiresInWindow[0]}
          />
          <TireDisplay
            label="RL"
            inner={tires.rear_left_inner}
            outer={tires.rear_left_outer}
            inWindow={tiresInWindow[2]}
          />
        </div>

        {/* Car body */}
        <div style={styles.carBody} />

        {/* Right side */}
        <div style={styles.tireColumn as React.CSSProperties}>
          <TireDisplay
            label="FR"
            inner={tires.front_right_inner}
            outer={tires.front_right_outer}
            inWindow={tiresInWindow[1]}
          />
          <TireDisplay
            label="RR"
            inner={tires.rear_right_inner}
            outer={tires.rear_right_outer}
            inWindow={tiresInWindow[3]}
          />
        </div>
      </div>
    </div>
  )
}
