import { useState } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { usePitStore } from '../../../stores/usePitStore'
import { generatePitLane } from '../../../utils/pitLaneGenerator'
import { generateCurbsForRoads } from '../../../utils/autoCurbGenerator'
import ToolSection, { popoverStyles } from './ToolSection'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    height: 32,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: 11,
    fontWeight: 500,
  },
  buttonActive: {
    borderColor: 'rgba(34, 197, 94, 0.5)',
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#4ade80',
  },
  buttonSuccess: {
    borderColor: 'rgba(34, 197, 94, 0.5)',
    background: 'rgba(34, 197, 94, 0.1)',
    color: '#22c55e',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  badge: {
    background: '#22c55e',
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
    padding: '2px 5px',
    borderRadius: 10,
    minWidth: 16,
    textAlign: 'center' as const,
  },
  popoverButton: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 'bold',
    transition: 'all 0.15s ease',
    marginTop: 8,
  },
  error: {
    color: '#ef4444',
    fontSize: 10,
    marginTop: 8,
  },
}

export default function GenerationTools() {
  const [pitPopoverOpen, setPitPopoverOpen] = useState(false)
  const [pitLaneError, setPitLaneError] = useState<string | null>(null)

  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const autoCurbMode = useCustomizationStore(s => s.autoCurbMode)
  const selectedRoadIds = useCustomizationStore(s => s.selectedRoadIds)
  const setAutoCurbMode = useCustomizationStore(s => s.setAutoCurbMode)
  const clearRoadSelection = useCustomizationStore(s => s.clearRoadSelection)
  const addGeneratedCurbs = useCustomizationStore(s => s.addGeneratedCurbs)
  const deleteMode = useCustomizationStore(s => s.deleteMode)
  const partialDeleteMode = useCustomizationStore(s => s.partialDeleteMode)
  const selectObjectType = useCustomizationStore(s => s.selectObjectType)
  const setDeleteMode = useCustomizationStore(s => s.setDeleteMode)
  const setPartialDeleteMode = useCustomizationStore(s => s.setPartialDeleteMode)

  const pitLaneData = usePitStore(s => s.pitLaneData)
  const setPitLaneData = usePitStore(s => s.setPitLaneData)
  const clearPitLane = usePitStore(s => s.clearPitLane)

  const checkpoint = placedObjects.find(obj => obj.type === 'checkpoint')
  const hasCheckpoint = !!checkpoint
  const hasPitLane = !!pitLaneData

  const handleGeneratePitLane = () => {
    if (!checkpoint) {
      setPitLaneError('Place a checkpoint first!')
      setTimeout(() => setPitLaneError(null), 3000)
      return
    }

    const pitData = generatePitLane(checkpoint, placedObjects)
    if (pitData) {
      setPitLaneData(pitData)
      setPitLaneError(null)
      setPitPopoverOpen(false)
    } else {
      setPitLaneError('Could not find valid pit lane position')
      setTimeout(() => setPitLaneError(null), 3000)
    }
  }

  const handleRemovePitLane = () => {
    clearPitLane()
    setPitPopoverOpen(false)
  }

  const handleToggleAutoCurbMode = () => {
    if (autoCurbMode) {
      clearRoadSelection()
      setAutoCurbMode(false)
    } else {
      if (deleteMode) setDeleteMode(false)
      if (partialDeleteMode) setPartialDeleteMode(false)
      selectObjectType(null)
      setAutoCurbMode(true)
    }
  }

  const handleGenerateCurbs = () => {
    if (selectedRoadIds.length === 0) return
    const curbs = generateCurbsForRoads(selectedRoadIds, placedObjects)
    if (curbs.length > 0) {
      addGeneratedCurbs(curbs)
      clearRoadSelection()
      setAutoCurbMode(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Pit Lane Button */}
      <ToolSection
        isOpen={pitPopoverOpen}
        onToggle={() => setPitPopoverOpen(prev => !prev)}
        popoverContent={
          <>
            <div style={popoverStyles.title}>Pit Lane</div>
            {hasPitLane ? (
              <>
                <div style={{ color: '#22c55e', fontSize: 11, marginBottom: 8 }}>
                  Pit lane active
                </div>
                <button
                  style={{ ...styles.popoverButton, background: '#dc2626', color: '#fff' }}
                  onClick={handleRemovePitLane}
                >
                  Remove Pit Lane
                </button>
              </>
            ) : (
              <>
                <div style={popoverStyles.hint}>
                  {hasCheckpoint
                    ? 'Generate a pit lane near the checkpoint'
                    : 'Place a checkpoint on a road first'}
                </div>
                <button
                  style={{
                    ...styles.popoverButton,
                    background: hasCheckpoint ? '#f59e0b' : '#666',
                    color: '#fff',
                    ...(hasCheckpoint ? {} : styles.buttonDisabled),
                  }}
                  onClick={handleGeneratePitLane}
                  disabled={!hasCheckpoint}
                >
                  Generate Pit Lane
                </button>
                {pitLaneError && <div style={styles.error}>{pitLaneError}</div>}
              </>
            )}
          </>
        }
      >
        <button
          style={{
            ...styles.button,
            ...(hasPitLane ? styles.buttonSuccess : {}),
          }}
          onClick={() => setPitPopoverOpen(prev => !prev)}
          title="Pit lane"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Pit
          {hasPitLane && <span style={{ color: '#22c55e' }}>OK</span>}
        </button>
      </ToolSection>

      {/* Auto Curbs Button */}
      <button
        style={{
          ...styles.button,
          ...(autoCurbMode ? styles.buttonActive : {}),
        }}
        onClick={handleToggleAutoCurbMode}
        title={autoCurbMode ? 'Cancel curb selection' : 'Select roads for auto curbs'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6l3-3 3 3M3 6v12l3 3 3-3V6" />
          <path d="M15 6l3-3 3 3M15 6v12l3 3 3-3V6" />
        </svg>
        Curbs
        {autoCurbMode && selectedRoadIds.length > 0 && (
          <span style={styles.badge}>{selectedRoadIds.length}</span>
        )}
      </button>

      {/* Generate Curbs Button - only when roads are selected */}
      {autoCurbMode && selectedRoadIds.length > 0 && (
        <button
          style={{
            ...styles.button,
            background: '#22c55e',
            color: '#000',
            fontWeight: 'bold',
            border: 'none',
          }}
          onClick={handleGenerateCurbs}
        >
          Generate
        </button>
      )}
    </div>
  )
}
