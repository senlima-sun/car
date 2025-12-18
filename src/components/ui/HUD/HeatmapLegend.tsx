import { useHeatmapStore } from '../../../stores/useHeatmapStore'
import { useThermalViewStore } from '../../../stores/useThermalViewStore'
import { useWindStore, getWindDirectionName, windSpeedToKmh, windSpeedDescription } from '../../../stores/useWindStore'
import { useWindViewStore } from '../../../stores/useWindViewStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 140,
    pointerEvents: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    paddingBottom: 6,
    marginBottom: 2,
  },
  title: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  gradientBar: {
    height: 12,
    borderRadius: 4,
    display: 'flex',
    overflow: 'hidden',
  },
  labels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  sectionLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    color: '#fff',
  },
  colorBox: {
    width: 14,
    height: 10,
    borderRadius: 2,
  },
  hint: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    marginTop: 4,
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    paddingTop: 6,
  },
}

// 5-stage temperature gradient colors with Celsius labels (unified scale)
const TEMP_GRADIENT = [
  { color: 'rgb(26, 51, 153)', label: '<10' },    // Deep blue (very cold)
  { color: 'rgb(51, 128, 230)', label: '10-30' }, // Light blue (cold)
  { color: 'rgb(51, 204, 77)', label: '30-60' },  // Green (moderate)
  { color: 'rgb(255, 153, 26)', label: '60-90' }, // Orange (warm)
  { color: 'rgb(255, 38, 26)', label: '>90' },    // Red (hot)
]

export default function HeatmapLegend() {
  const isHeatmapVisible = useHeatmapStore(s => s.isVisible)
  const isThermalView = useThermalViewStore(s => s.isEnabled)
  const isWindViewEnabled = useWindViewStore(s => s.isEnabled)

  // Wind state
  const windDirection = useWindStore(s => s.direction)
  const windSpeed = useWindStore(s => s.speed)
  const currentSpeed = useWindStore(s => s.currentSpeed)
  const gustIntensity = useWindStore(s => s.gustIntensity)
  const windEnabled = useWindStore(s => s.enabled)

  // Don't render if no visualization is active
  if (!isHeatmapVisible && !isThermalView && !isWindViewEnabled) {
    return null
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Track Conditions</span>
      </div>

      {/* Temperature gradient */}
      <div style={styles.section as React.CSSProperties}>
        <span style={styles.sectionLabel}>Temperature</span>
        <div style={styles.gradientBar}>
          {TEMP_GRADIENT.map((stop, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: stop.color,
              }}
            />
          ))}
        </div>
        <div style={styles.labels}>
          <span>&lt;10C</span>
          <span>30-60C</span>
          <span>&gt;90C</span>
        </div>
      </div>

      {/* Surface conditions legend */}
      <div style={styles.section as React.CSSProperties}>
        <span style={styles.sectionLabel}>Surface</span>
        <div style={styles.legendItem}>
          <div style={{ ...styles.colorBox, background: 'rgb(51, 77, 128)' }} />
          <span>Water</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.colorBox, background: 'rgb(204, 230, 255)' }} />
          <span>Ice</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.colorBox, background: 'rgb(102, 26, 128)' }} />
          <span>Rubber</span>
        </div>
      </div>

      {/* Wind section */}
      {isWindViewEnabled && windEnabled && (
        <div style={styles.section as React.CSSProperties}>
          <span style={styles.sectionLabel}>Wind</span>
          <div style={styles.legendItem}>
            <span style={{ fontWeight: 'bold', color: '#6bb8ff' }}>
              {getWindDirectionName(windDirection)}
            </span>
            <span style={{ marginLeft: 'auto' }}>
              {windSpeedToKmh(currentSpeed || windSpeed).toFixed(0)} km/h
            </span>
          </div>
          <div style={styles.legendItem}>
            <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              {windSpeedDescription(currentSpeed || windSpeed)}
            </span>
            {gustIntensity > 0.3 && (
              <span style={{ marginLeft: 'auto', color: '#ffaa33' }}>
                Gusting
              </span>
            )}
          </div>
        </div>
      )}

      {isWindViewEnabled && !windEnabled && (
        <div style={styles.section as React.CSSProperties}>
          <span style={styles.sectionLabel}>Wind</span>
          <div style={styles.legendItem}>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Disabled</span>
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div style={styles.hint as React.CSSProperties}>
        Press H to toggle
      </div>
    </div>
  )
}
