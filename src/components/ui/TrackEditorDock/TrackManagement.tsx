import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { usePitStore } from '../../../stores/usePitStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  button: {
    height: 32,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: 11,
    fontWeight: 'bold',
  },
  saveButton: {
    background: '#2563eb',
    color: '#fff',
  },
  exportButton: {
    background: '#8b5cf6',
    color: '#fff',
  },
  clearButton: {
    background: 'rgba(220, 38, 38, 0.2)',
    color: '#ff6b6b',
    border: '1px solid rgba(220, 38, 38, 0.3)',
  },
}

export default function TrackManagement() {
  const clearAll = useCustomizationStore(s => s.clearAll)
  const saveCurrentTrack = useTrackStore(s => s.saveCurrentTrack)
  const exportCurrentTrack = useTrackStore(s => s.exportCurrentTrack)
  const isDirty = useTrackStore(s => s.isDirty)
  const clearPitLane = usePitStore(s => s.clearPitLane)

  const handleClearAll = () => {
    if (window.confirm('Clear all placed objects?')) {
      clearAll()
      clearPitLane()
    }
  }

  return (
    <div style={styles.container}>
      {/* Status Indicator */}
      <div
        style={{
          ...styles.statusDot,
          background: isDirty ? '#fbbf24' : '#22c55e',
        }}
        title={isDirty ? 'Unsaved changes' : 'All changes saved'}
      />

      {/* Save Button */}
      <button
        style={{ ...styles.button, ...styles.saveButton }}
        onClick={saveCurrentTrack}
        title='Save track'
      >
        <svg
          width='12'
          height='12'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2.5'
        >
          <path d='M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z' />
          <polyline points='17 21 17 13 7 13 7 21' />
          <polyline points='7 3 7 8 15 8' />
        </svg>
        Save
      </button>

      {/* Export Button */}
      <button
        style={{ ...styles.button, ...styles.exportButton }}
        onClick={exportCurrentTrack}
        title='Export track as JSON'
      >
        <svg
          width='12'
          height='12'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2.5'
        >
          <path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4' />
          <polyline points='7 10 12 15 17 10' />
          <line x1='12' y1='15' x2='12' y2='3' />
        </svg>
        Export
      </button>

      {/* Clear Button */}
      <button
        style={{ ...styles.button, ...styles.clearButton }}
        onClick={handleClearAll}
        title='Clear all objects'
      >
        <svg
          width='12'
          height='12'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2.5'
        >
          <line x1='18' y1='6' x2='6' y2='18' />
          <line x1='6' y1='6' x2='18' y2='18' />
        </svg>
        Clear
      </button>
    </div>
  )
}
