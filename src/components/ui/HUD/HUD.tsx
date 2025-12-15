import Speedometer from './Speedometer'
import GearIndicator from './GearIndicator'
import TireIndicator from './TireIndicator'
import PitStopUI from './PitStopUI'
import StatusBar from './StatusBar'
import ControlsModal from './ControlsModal'
import { useGameStore } from '../../../stores/useGameStore'
import { usePitStore } from '../../../stores/usePitStore'
import { CustomizationPanel, ModeToggle } from '../CustomizationPanel'
import { TrackSelector } from '../TrackSelector'

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
  bottomLeft: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    display: 'flex',
    gap: 20,
    alignItems: 'flex-end',
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
  const status = useGameStore(state => state.status)
  const isInPitBox = usePitStore(state => state.isInPitBox)
  const isCustomizeMode = status === 'customize'

  return (
    <div style={styles.container}>
      {/* Controls modal trigger - always visible */}
      <ControlsModal />

      {/* Mode toggle - always visible */}
      <ModeToggle />

      {isCustomizeMode ? (
        /* Customize mode UI */
        <>
          <div style={styles.trackSelectorContainer}>
            <TrackSelector />
          </div>
          <CustomizationPanel />
        </>
      ) : (
        /* Race mode UI */
        <>
          {/* Status bar - top left with weather, FPS, tire, camera, lap times */}
          <StatusBar />

          {/* Speed, gear, and tires */}
          <div style={styles.bottomLeft}>
            <Speedometer />
            <GearIndicator />
            <TireIndicator />
          </div>

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
                padding: '12px 24px',
                borderRadius: 8,
                fontWeight: 'bold',
                fontSize: 16,
                pointerEvents: 'none',
              }}
            >
              Press P to open tire selection
            </div>
          )}

          {/* Pit stop UI overlay */}
          <PitStopUI />
        </>
      )}
    </div>
  )
}
