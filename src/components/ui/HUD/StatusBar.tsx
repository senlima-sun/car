import { useEffect } from 'react'
import { useFPSStore } from '../../../stores/useFPSStore'
import { useTireStore } from '../../../stores/useTireStore'
import { useGameStore } from '../../../stores/useGameStore'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'
import { TIRE_CONFIG } from '../../../constants/tires'
import { useMobileDetection } from '../../../utils/isMobile'
import { UI, PERFORMANCE, LAP_TIMER, STATUS, TIRE_COMPOUND } from '@/constants/colors'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 20,
    left: 20,
    background: 'rgba(0, 0, 0, 0.7)',
    padding: '10px 16px',
    borderRadius: 8,
    color: UI.textPrimary,
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
    background: LAP_TIMER.recording,
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

// Mobile-specific styles
const mobileStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    background: 'rgba(0, 0, 0, 0.75)',
    padding: '6px 10px',
    borderRadius: 6,
    color: UI.textPrimary,
    fontSize: 11,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  separator: {
    opacity: 0.3,
    userSelect: 'none',
  },
  lapTime: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
  },
  recordingDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: LAP_TIMER.recording,
    animation: 'pulse 1s infinite',
  },
}

function getFPSColor(fps: number): string {
  if (fps >= 50) return PERFORMANCE.fpsGood
  if (fps >= 30) return PERFORMANCE.fpsWarning
  return PERFORMANCE.fpsBad
}

function formatTime(ms: number | null): string {
  if (ms === null) return '--:--.---'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor(ms % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export default function StatusBar() {
  const isMobile = useMobileDetection()
  const fps = useFPSStore(state => state.fps)
  const currentCompound = useTireStore(state => state.currentCompound)
  const cameraMode = useGameStore(state => state.cameraMode)
  const isTestingMode = useGameStore(state => state.isTestingMode)

  // Lap timer state
  const isLapActive = useLapTimeStore(state => state.isActive)
  const isRecording = useLapTimeStore(state => state.isRecording)
  const currentLapStart = useLapTimeStore(state => state.currentLapStart)
  const currentLapTime = useLapTimeStore(state => state.currentLapTime)
  const lapCount = useLapTimeStore(state => state.lapCount)
  const updateCurrentTime = useLapTimeStore(state => state.updateCurrentTime)

  // Update current lap time at 10Hz (not every frame)
  useEffect(() => {
    if (!isLapActive || !isRecording || currentLapStart === null) return

    const intervalId = setInterval(updateCurrentTime, 100)
    return () => clearInterval(intervalId)
  }, [isLapActive, isRecording, currentLapStart, updateCurrentTime])

  const tireConfig = TIRE_CONFIG[currentCompound]
  const fpsColor = getFPSColor(fps)
  const hasLapStarted = currentLapStart !== null

  // Mobile: Condensed icons-only layout
  if (isMobile) {
    return (
      <div style={mobileStyles.container}>
        <style>
          {`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          `}
        </style>

        {/* FPS with color */}
        <span style={{ color: fpsColor, fontWeight: 'bold' }}>{fps}</span>

        <span style={mobileStyles.separator}>|</span>

        {/* Tire icon with color */}
        <span
          style={{
            color: tireConfig.color,
            textShadow: tireConfig.color === TIRE_COMPOUND.hard ? '0 0 2px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          {tireConfig.icon}
        </span>

        <span style={mobileStyles.separator}>|</span>

        {/* Camera abbreviated */}
        <span style={{ fontWeight: 'bold' }}>{cameraMode === 'third-person' ? '3P' : '1P'}</span>

        <span style={mobileStyles.separator}>|</span>

        {/* Mode indicator */}
        <span
          style={{
            fontWeight: 'bold',
            color: isTestingMode ? STATUS.danger : STATUS.successLight,
          }}
        >
          {isTestingMode ? 'TST' : 'RCE'}
        </span>

        {/* Lap time (if recording) - show only current */}
        {isLapActive && isRecording && (
          <>
            <span style={mobileStyles.separator}>|</span>
            <div style={mobileStyles.item}>
              <div style={mobileStyles.recordingDot} />
              <span style={{ ...mobileStyles.lapTime, color: LAP_TIMER.bestLap }}>
                {hasLapStarted ? formatTime(currentLapTime) : '...'}
              </span>
            </div>
          </>
        )}
      </div>
    )
  }

  // Desktop: Full layout
  return (
    <div style={styles.container}>
      <div style={styles.row}>
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
              textShadow: tireConfig.color === TIRE_COMPOUND.hard ? '0 0 2px rgba(0,0,0,0.5)' : 'none',
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

        <span style={styles.separator}>|</span>

        {/* Mode */}
        <div style={styles.item}>
          <span style={styles.label}>Mode:</span>
          <span
            style={{
              ...styles.value,
              color: isTestingMode ? STATUS.danger : STATUS.successLight,
            }}
          >
            {isTestingMode ? 'TEST' : 'RACE'}
          </span>
        </div>
      </div>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={styles.recordingDot} />
                <span style={{ ...styles.label, color: LAP_TIMER.recording }}>REC</span>
              </div>
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
