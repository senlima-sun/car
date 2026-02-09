import { useState } from 'react'
import { useEditorStore } from '../../../stores/useEditorStore'
import ToolSection, { popoverStyles } from './ToolSection'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  segmentedControl: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 2,
  },
  segment: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  segmentActive: {
    background: 'rgba(0, 255, 0, 0.2)',
    color: '#00ff00',
  },
  settingsButton: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.05)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    padding: 0,
  },
  settingsButtonActive: {
    borderColor: 'rgba(0, 255, 0, 0.3)',
    background: 'rgba(0, 255, 0, 0.1)',
  },
}

export default function TrackSettings() {
  const [showSettings, setShowSettings] = useState(false)
  const trackMode = useEditorStore(s => s.trackMode)
  const setTrackMode = useEditorStore(s => s.setTrackMode)
  const snapSettings = useEditorStore(s => s.snapSettings)
  const setSnapSettings = useEditorStore(s => s.setSnapSettings)

  const hasActiveSnap = snapSettings.angleSnap || snapSettings.tangentSnap

  return (
    <div style={styles.container}>
      {/* Road Type Toggle */}
      <div style={styles.segmentedControl}>
        <button
          style={{
            ...styles.segment,
            ...(trackMode === 'straight' ? styles.segmentActive : {}),
          }}
          onClick={() => setTrackMode('straight')}
        >
          Straight
        </button>
        <button
          style={{
            ...styles.segment,
            ...(trackMode === 'curve' ? styles.segmentActive : {}),
          }}
          onClick={() => setTrackMode('curve')}
        >
          Curve
        </button>
        <button
          style={{
            ...styles.segment,
            ...(trackMode === 'pitroad' ? { ...styles.segmentActive, color: '#ff6600', background: 'rgba(255, 102, 0, 0.2)' } : {}),
          }}
          onClick={() => setTrackMode('pitroad')}
          title='Pit lane road (speed limited)'
        >
          Pit
        </button>
        <button
          style={{
            ...styles.segment,
            ...(trackMode === 'pitroad-curve' ? { ...styles.segmentActive, color: '#ff6600', background: 'rgba(255, 102, 0, 0.2)' } : {}),
          }}
          onClick={() => setTrackMode('pitroad-curve')}
          title='Curved pit lane road'
        >
          Pit&#8635;
        </button>
      </div>

      {/* Snap Settings Popover */}
      <ToolSection
        isOpen={showSettings}
        onToggle={() => setShowSettings(prev => !prev)}
        popoverContent={
          <>
            <div style={popoverStyles.title}>Snap Settings</div>

            {/* Angle Snap Toggle */}
            <div
              style={{ ...popoverStyles.row, cursor: 'pointer' }}
              onClick={() => setSnapSettings({ angleSnap: !snapSettings.angleSnap })}
            >
              <span style={popoverStyles.label}>Angle Snap (15/30/45/90)</span>
              <div
                style={{
                  ...popoverStyles.toggle,
                  background: snapSettings.angleSnap ? '#22c55e' : '#444',
                }}
              >
                <div
                  style={{
                    ...popoverStyles.toggleKnob,
                    left: snapSettings.angleSnap ? 20 : 2,
                  }}
                />
              </div>
            </div>

            {/* Tangent Continuation Toggle */}
            <div
              style={{ ...popoverStyles.row, cursor: 'pointer' }}
              onClick={() => setSnapSettings({ tangentSnap: !snapSettings.tangentSnap })}
            >
              <span style={popoverStyles.label}>Tangent Continuation</span>
              <div
                style={{
                  ...popoverStyles.toggle,
                  background: snapSettings.tangentSnap ? '#22c55e' : '#444',
                }}
              >
                <div
                  style={{
                    ...popoverStyles.toggleKnob,
                    left: snapSettings.tangentSnap ? 20 : 2,
                  }}
                />
              </div>
            </div>

            <div style={popoverStyles.hint}>
              Angle snap aligns roads to grid angles. Tangent creates smooth curves when connecting.
            </div>
          </>
        }
      >
        <button
          style={{
            ...styles.settingsButton,
            ...(showSettings || hasActiveSnap ? styles.settingsButtonActive : {}),
          }}
          onClick={() => setShowSettings(prev => !prev)}
          title='Snap settings'
        >
          <svg
            width='16'
            height='16'
            viewBox='0 0 24 24'
            fill='none'
            stroke={hasActiveSnap ? '#00ff00' : '#888'}
            strokeWidth='2'
          >
            <circle cx='12' cy='12' r='3' />
            <path d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' />
          </svg>
        </button>
      </ToolSection>
    </div>
  )
}
