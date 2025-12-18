import { useEffect, useState, useRef } from 'react'
import RacePanel from './RacePanel'
import StatsPanel from './StatsPanel'
import ErsIndicator from './ErsIndicator'
import AeroIndicator from './AeroIndicator'
import BrakeIndicator from './BrakeIndicator'
import PitStopUI from './PitStopUI'
import StatusBar from './StatusBar'
import KeymapModal from './KeymapModal'
import WeatherControlModal from './WeatherControlModal'
import HeatmapLegend from './HeatmapLegend'
import AquaplaningIndicator from './AquaplaningIndicator'
import DebugPanel from './DebugPanel'
import { useGameStore } from '../../../stores/useGameStore'
import { usePitStore } from '../../../stores/usePitStore'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { ModeToggle } from '../CustomizationPanel'
import { TrackEditorDock } from '../TrackEditorDock'
import { TrackSelector } from '../TrackSelector'
import { MobileControls, MobileSpeedGear } from '../MobileControls'
import { useMobileDetection } from '../../../utils/isMobile'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  bottomCenter: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
  },
  bottomRight: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'flex-end',
  },
  bottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    pointerEvents: 'auto',
  },
  trackSelectorContainer: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    pointerEvents: 'auto',
  },
}

export default function HUD() {
  const isMobile = useMobileDetection()
  const status = useGameStore(state => state.status)
  const cameraMode = useGameStore(state => state.cameraMode)
  const isTestingMode = useGameStore(state => state.isTestingMode)
  const toggleTestingMode = useGameStore(state => state.toggleTestingMode)
  const isInPitBox = usePitStore(state => state.isInPitBox)
  const isCustomizeMode = status === 'customize'
  const toggleEnvironmentModal = useEnvironmentStore(state => state.toggleModal)
  const isEnvironmentModalOpen = useEnvironmentStore(state => state.isModalOpen)

  // Debug panel visibility state
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  // Mode notification state
  const [modeNotification, setModeNotification] = useState<string | null>(null)
  const prevTestingMode = useRef(isTestingMode)

  // Show notification when testing mode changes
  useEffect(() => {
    if (prevTestingMode.current !== isTestingMode) {
      setModeNotification(isTestingMode ? 'Testing Mode Enabled' : 'Racing Mode Enabled')
      const timer = setTimeout(() => setModeNotification(null), 2000)
      prevTestingMode.current = isTestingMode
      return () => clearTimeout(timer)
    }
  }, [isTestingMode])

  // Listen for Shift+\ to toggle testing mode, M key for environment modal, ` for debug panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Shift + \ toggles testing mode
      if (e.shiftKey && e.code === 'Backslash') {
        toggleTestingMode()
        e.preventDefault()
        return
      }

      // Gate testing controls - only process when in testing mode
      if (!isTestingMode) return

      // Toggle environment modal with M
      if (e.code === 'KeyM' && !isEnvironmentModalOpen) {
        toggleEnvironmentModal()
      }

      // Toggle debug panel with ` (backtick)
      if (e.code === 'Backquote') {
        setShowDebugPanel(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleEnvironmentModal, isEnvironmentModalOpen, isTestingMode, toggleTestingMode])

  return (
    <div style={styles.container}>
      {/* Keymap modal trigger - always visible */}
      <KeymapModal />

      {/* Mode change notification */}
      {modeNotification && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: isTestingMode ? 'rgba(239, 68, 68, 0.9)' : 'rgba(74, 222, 128, 0.9)',
            color: '#fff',
            padding: '16px 32px',
            borderRadius: 8,
            fontWeight: 'bold',
            fontSize: 18,
            pointerEvents: 'none',
            zIndex: 999,
            animation: 'fadeInOut 2s ease',
          }}
        >
          {modeNotification}
        </div>
      )}

      {/* Weather/Environment control modal */}
      <WeatherControlModal />

      {/* Mode toggle - hide on mobile */}
      {!isMobile && <ModeToggle />}

      {isCustomizeMode ? (
        /* Customize mode UI */
        <>
          <div style={styles.trackSelectorContainer}>
            <TrackSelector />
          </div>
          <TrackEditorDock />
        </>
      ) : (
        /* Race mode UI */
        <>
          {/* Status bar - top left with weather, FPS, tire, camera, lap times */}
          <StatusBar />

          {/* Mobile: Centered compact speed/gear display */}
          {isMobile && <MobileSpeedGear />}

          {/* Desktop: Race panel bottom-center, Stats panel bottom-right, Debug panel bottom-left */}
          {!isMobile && cameraMode !== 'first-person' && (
            <>
              <div style={styles.bottomCenter}>
                <RacePanel />
              </div>
              <div style={styles.bottomRight as React.CSSProperties}>
                <AeroIndicator />
                <ErsIndicator />
                <BrakeIndicator />
                <StatsPanel />
              </div>
              {showDebugPanel && (
                <div style={styles.bottomLeft}>
                  <DebugPanel />
                </div>
              )}
            </>
          )}

          {/* Pit box hint when in pit */}
          {isInPitBox && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255, 102, 0, 0.9)',
                color: '#fff',
                padding: isMobile ? '8px 16px' : '12px 24px',
                borderRadius: 8,
                fontWeight: 'bold',
                fontSize: isMobile ? 14 : 16,
                pointerEvents: 'none',
              }}
            >
              {isMobile ? 'Tap P for tires' : 'Press P to open tire selection'}
            </div>
          )}

          {/* Pit stop UI overlay */}
          <PitStopUI />

          {/* Mobile touch controls */}
          {isMobile && <MobileControls />}

          {/* Heatmap/Thermal view legend */}
          {!isMobile && <HeatmapLegend />}

          {/* Aquaplaning/Thermal shock warning overlay */}
          <AquaplaningIndicator />
        </>
      )}
    </div>
  )
}
