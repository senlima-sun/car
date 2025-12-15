import { useWeatherStore } from '../../../stores/useWeatherStore'
import { WEATHER_CONFIG } from '../../../constants/weather'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    left: 20,
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '12px 16px',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    minWidth: 120,
    pointerEvents: 'auto',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.2s ease',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  description: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4,
  },
  hint: {
    fontSize: 10,
    opacity: 0.5,
    marginTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.2)',
    paddingTop: 6,
  },
  transitionBar: {
    height: 2,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  transitionProgress: {
    height: '100%',
    background: '#4CAF50',
    transition: 'width 0.1s linear',
  },
}

export default function WeatherIndicator() {
  const currentWeather = useWeatherStore(state => state.currentWeather)
  const isTransitioning = useWeatherStore(state => state.isTransitioning)
  const transitionProgress = useWeatherStore(state => state.transitionProgress)
  const cycleWeather = useWeatherStore(state => state.cycleWeather)

  const config = WEATHER_CONFIG[currentWeather]

  return (
    <div style={styles.container} onClick={cycleWeather} title='Click to change weather'>
      <div style={styles.header}>
        <span style={styles.icon}>{config.icon}</span>
        <span style={styles.name}>{config.displayName}</span>
      </div>
      <div style={styles.description}>{config.description}</div>

      {isTransitioning && (
        <div style={styles.transitionBar}>
          <div
            style={{
              ...styles.transitionProgress,
              width: `${transitionProgress * 100}%`,
            }}
          />
        </div>
      )}

      <div style={styles.hint}>Press [Q] or click to change</div>
    </div>
  )
}
