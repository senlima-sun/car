import { useEffect } from 'react'
import { useFPSStore } from '../../../stores/useFPSStore'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import { useTireStore } from '../../../stores/useTireStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { WEATHER_CONFIG } from '../../../constants/weather'
import { TIRE_CONFIG } from '../../../constants/tires'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    left: 20,
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '10px 16px',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    opacity: 0.6,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  value: {
    fontWeight: 'bold',
  },
  separator: {
    opacity: 0.3,
    userSelect: 'none',
  },
  weatherClickable: {
    cursor: 'pointer',
    padding: '2px 6px',
    margin: '-2px -6px',
    borderRadius: 4,
    transition: 'background 0.2s ease',
    pointerEvents: 'auto',
  },
  transitionBar: {
    height: 2,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  transitionProgress: {
    height: '100%',
    background: '#4CAF50',
    transition: 'width 0.1s linear',
  },
  lapRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderTop: '1px solid rgba(255, 255, 255, 0.15)',
    paddingTop: 6,
    marginTop: 2,
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#ff4444',
    animation: 'pulse 1s infinite',
  },
  lapTime: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  lapHint: {
    fontSize: 11,
    opacity: 0.5,
  },
}

function getFPSColor(fps: number): string {
  if (fps >= 50) return '#4ade80' // green
  if (fps >= 30) return '#facc15' // yellow
  return '#f87171' // red
}

function formatTime(ms: number | null): string {
  if (ms === null) return '--:--.---'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export default function StatusBar() {
  const fps = useFPSStore(state => state.fps)
  const currentWeather = useWeatherStore(state => state.currentWeather)
  const isTransitioning = useWeatherStore(state => state.isTransitioning)
  const transitionProgress = useWeatherStore(state => state.transitionProgress)
  const cycleWeather = useWeatherStore(state => state.cycleWeather)
  const currentCompound = useTireStore(state => state.currentCompound)
  const cameraMode = useGameStore(state => state.cameraMode)

  // Lap timer state
  const isLapActive = useLapTimeStore(state => state.isActive)
  const isRecording = useLapTimeStore(state => state.isRecording)
  const currentLapStart = useLapTimeStore(state => state.currentLapStart)
  const currentLapTime = useLapTimeStore(state => state.currentLapTime)
  const lastLapTime = useLapTimeStore(state => state.lastLapTime)
  const bestLapTime = useLapTimeStore(state => state.bestLapTime)
  const lapCount = useLapTimeStore(state => state.lapCount)
  const updateCurrentTime = useLapTimeStore(state => state.updateCurrentTime)

  // Update current lap time every frame
  useEffect(() => {
    if (!isLapActive || !isRecording || currentLapStart === null) return

    let animationId: number
    const update = () => {
      updateCurrentTime()
      animationId = requestAnimationFrame(update)
    }
    animationId = requestAnimationFrame(update)

    return () => cancelAnimationFrame(animationId)
  }, [isLapActive, isRecording, currentLapStart, updateCurrentTime])

  const weatherConfig = WEATHER_CONFIG[currentWeather]
  const tireConfig = TIRE_CONFIG[currentCompound]
  const fpsColor = getFPSColor(fps)
  const hasLapStarted = currentLapStart !== null

  return (
    <div style={styles.container}>
      <div style={styles.row}>
        {/* Weather - clickable */}
        <div
          style={{
            ...styles.item,
            ...styles.weatherClickable,
          }}
          onClick={cycleWeather}
          title='Click to change weather (Q)'
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span style={styles.label}>Weather:</span>
          <span style={styles.value}>
            {weatherConfig.icon} {weatherConfig.displayName}
          </span>
        </div>

        <span style={styles.separator}>|</span>

        {/* FPS */}
        <div style={styles.item}>
          <span style={styles.label}>FPS:</span>
          <span style={{ ...styles.value, color: fpsColor }}>{fps}</span>
        </div>

        <span style={styles.separator}>|</span>

        {/* Tire */}
        <div style={styles.item}>
          <span style={styles.label}>Tire:</span>
          <span
            style={{
              ...styles.value,
              color: tireConfig.color,
              textShadow: tireConfig.color === '#ffffff' ? '0 0 2px rgba(0,0,0,0.5)' : 'none',
            }}
          >
            {tireConfig.icon}
          </span>
        </div>

        <span style={styles.separator}>|</span>

        {/* Camera */}
        <div style={styles.item}>
          <span style={styles.label}>Cam:</span>
          <span style={styles.value}>{cameraMode === 'third-person' ? 'Chase' : 'Cockpit'}</span>
        </div>
      </div>

      {/* Weather transition progress bar */}
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

      {/* Lap Timer Row */}
      {isLapActive && (
        <div style={styles.lapRow}>
          <style>
            {`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
              }
            `}
          </style>

          {isRecording ? (
            <>
              {/* Recording indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={styles.recordingDot} />
                <span style={{ ...styles.label, color: '#ff4444' }}>REC</span>
              </div>

              {/* Current time */}
              <div style={styles.item}>
                <span style={styles.label}>Lap:</span>
                <span style={{ ...styles.lapTime, color: '#00ff88' }}>
                  {hasLapStarted ? formatTime(currentLapTime) : 'Waiting...'}
                </span>
              </div>

              {/* Last lap */}
              <div style={styles.item}>
                <span style={styles.label}>Last:</span>
                <span style={styles.lapTime}>{formatTime(lastLapTime)}</span>
              </div>

              {/* Best lap */}
              <div style={styles.item}>
                <span style={styles.label}>Best:</span>
                <span style={{ ...styles.lapTime, color: '#ff00ff' }}>
                  {formatTime(bestLapTime)}
                </span>
              </div>

              {/* Lap count */}
              <div style={styles.item}>
                <span style={styles.label}>#</span>
                <span style={styles.value}>{lapCount}</span>
              </div>
            </>
          ) : (
            <span style={styles.lapHint}>Press R to start lap timing</span>
          )}
        </div>
      )}
    </div>
  )
}
