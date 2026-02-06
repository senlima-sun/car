import { useEffect, useState } from 'react'
import {
  useCustomizationStore,
  type ObjectType,
  isLinearObject,
} from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { usePitStore } from '../../../stores/usePitStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { useTrackGraphStore } from '../../../stores/useTrackGraphStore'
import { OBJECT_TYPES } from '../../../constants/trackObjects'
import { generatePitLane } from '../../../utils/pitLaneGenerator'
import { generateCurbsForRoads } from '../../../utils/autoCurbGenerator'
import ObjectButton from './ObjectButton'

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    left: 20,
    top: 80,
    background: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 10,
    pointerEvents: 'auto',
    maxWidth: 220,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottom: '1px solid #333',
    paddingBottom: 8,
  },
  objectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    marginBottom: 15,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  buttonRow: {
    display: 'flex',
    gap: 6,
  },
  actionButton: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  saveButton: {
    background: '#2563eb',
    color: '#fff',
  },
  loadButton: {
    background: '#059669',
    color: '#fff',
  },
  clearButton: {
    background: '#dc2626',
    color: '#fff',
  },
  exportButton: {
    background: '#8b5cf6',
    color: '#fff',
  },
  stats: {
    color: '#666',
    fontSize: 11,
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid #333',
  },
  controls: {
    marginTop: 12,
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
  },
  controlLine: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  key: {
    color: '#fff',
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '2px 6px',
    borderRadius: 3,
    marginRight: 6,
    fontFamily: 'monospace',
  },
  modeToggle: {
    display: 'flex',
    gap: 4,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
    padding: '6px 10px',
    border: '2px solid transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  modeButtonActive: {
    background: 'rgba(0, 255, 0, 0.2)',
    borderColor: '#00ff00',
    color: '#00ff00',
  },
  modeButtonInactive: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#888',
  },
  placementHint: {
    color: '#888',
    fontSize: 10,
    marginTop: 6,
    padding: '6px 8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    lineHeight: 1.4,
  },
  deleteButton: {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    marginBottom: 10,
  },
  deleteButtonActive: {
    background: 'rgba(220, 38, 38, 0.3)',
    borderColor: '#dc2626',
    color: '#ff6b6b',
  },
  deleteButtonInactive: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#888',
  },
  selectedInfo: {
    color: '#ff6b6b',
    fontSize: 11,
    padding: '8px',
    background: 'rgba(220, 38, 38, 0.2)',
    borderRadius: 4,
    marginTop: 6,
    textAlign: 'center' as const,
  },
  snapToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    marginBottom: 6,
    cursor: 'pointer',
  },
  snapToggleLabel: {
    color: '#aaa',
    fontSize: 11,
  },
  snapToggleSwitch: {
    width: 36,
    height: 18,
    borderRadius: 9,
    position: 'relative' as const,
    transition: 'background 0.2s ease',
  },
  snapToggleKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    background: '#fff',
    position: 'absolute' as const,
    top: 2,
    transition: 'left 0.2s ease',
  },
}

export default function CustomizationPanel() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const removeObject = useCustomizationStore(s => s.removeObject)
  const clearAll = useCustomizationStore(s => s.clearAll)
  const addGeneratedCurbs = useCustomizationStore(s => s.addGeneratedCurbs)

  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const trackMode = useEditorStore(s => s.trackMode)
  const placementState = useEditorStore(s => s.placementState)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const deleteMode = useEditorStore(s => s.deleteMode)
  const selectObjectType = useEditorStore(s => s.selectObjectType)
  const setTrackMode = useEditorStore(s => s.setTrackMode)
  const setDeleteMode = useEditorStore(s => s.setDeleteMode)
  const partialDeleteMode = useEditorStore(s => s.partialDeleteMode)
  const partialDeleteState = useEditorStore(s => s.partialDeleteState)
  const setPartialDeleteMode = useEditorStore(s => s.setPartialDeleteMode)
  const cancelPartialDelete = useEditorStore(s => s.cancelPartialDelete)
  const autoCurbMode = useEditorStore(s => s.autoCurbMode)
  const selectedRoadIds = useEditorStore(s => s.selectedRoadIds)
  const setAutoCurbMode = useEditorStore(s => s.setAutoCurbMode)
  const clearRoadSelection = useEditorStore(s => s.clearRoadSelection)
  const snapSettings = useEditorStore(s => s.snapSettings)
  const setSnapSettings = useEditorStore(s => s.setSnapSettings)

  // Track store
  const saveCurrentTrack = useTrackStore(s => s.saveCurrentTrack)
  const exportCurrentTrack = useTrackStore(s => s.exportCurrentTrack)
  const markDirty = useTrackStore(s => s.markDirty)
  const isDirty = useTrackStore(s => s.isDirty)

  // Pit lane state
  const pitLaneData = usePitStore(s => s.pitLaneData)
  const setPitLaneData = usePitStore(s => s.setPitLaneData)
  const clearPitLane = usePitStore(s => s.clearPitLane)
  const [pitLaneError, setPitLaneError] = useState<string | null>(null)

  // Track direction
  const hasFlow = useTrackGraphStore(s => s.hasFlow)
  const flowWarnings = useTrackGraphStore(s => s.flowWarnings)
  const setTrackFlow = useTrackGraphStore(s => s.setTrackFlow)
  const clearTrackFlow = useTrackGraphStore(s => s.clearTrackFlow)

  // Check if checkpoint exists
  const checkpoint = placedObjects.find(obj => obj.type === 'checkpoint')
  const hasCheckpoint = !!checkpoint

  // Handle pit lane generation
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
    } else {
      setPitLaneError('Could not find valid pit lane position')
      setTimeout(() => setPitLaneError(null), 3000)
    }
  }

  // Mark track as dirty when objects change
  useEffect(() => {
    markDirty()
  }, [placedObjects, markDirty])

  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      saveCurrentTrack()
    }, 2000) // Auto-save after 2 seconds of no changes
    return () => clearTimeout(timer)
  }, [placedObjects, isDirty, saveCurrentTrack])

  // Handle Delete/Backspace key to delete selected object
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        // Prevent backspace from navigating back
        if (e.key === 'Backspace' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault()
        }
        removeObject(selectedObjectId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjectId, removeObject])

  const handleSelectType = (type: ObjectType) => {
    // Turn off delete modes when selecting an object type
    if (deleteMode) setDeleteMode(false)
    if (partialDeleteMode) setPartialDeleteMode(false)
    if (selectedObjectType === type) {
      selectObjectType(null)
    } else {
      selectObjectType(type)
    }
  }

  const handleToggleDeleteMode = () => {
    // Turn off partial delete mode if active
    if (partialDeleteMode) setPartialDeleteMode(false)
    if (deleteMode) {
      setDeleteMode(false)
    } else {
      // Clear any object type selection when entering delete mode
      selectObjectType(null)
      setDeleteMode(true)
    }
  }

  const handleTogglePartialDeleteMode = () => {
    // Turn off regular delete mode if active
    if (deleteMode) setDeleteMode(false)
    if (partialDeleteMode) {
      cancelPartialDelete()
      setPartialDeleteMode(false)
    } else {
      // Clear any object type selection when entering partial delete mode
      selectObjectType(null)
      setPartialDeleteMode(true)
    }
  }

  const handleDeleteSelected = () => {
    if (selectedObjectId) {
      removeObject(selectedObjectId)
    }
  }

  // Handle auto curb generation
  const handleToggleAutoCurbMode = () => {
    if (autoCurbMode) {
      clearRoadSelection()
      setAutoCurbMode(false)
    } else {
      // Clear other modes
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

  // Get selected object info
  const selectedObject = selectedObjectId
    ? placedObjects.find(obj => obj.id === selectedObjectId)
    : null

  // Check if current selected object is a linear type (road/barrier)
  const showTrackModeToggle = selectedObjectType && isLinearObject(selectedObjectType)

  // Get placement hint based on current state
  const getPlacementHint = () => {
    if (!selectedObjectType) return null
    if (!isLinearObject(selectedObjectType)) return 'Click to place'

    if (trackMode === 'curve') {
      switch (placementState) {
        case 'selecting':
          return '1. Click to set START point'
        case 'dragging':
          return '2. Click to set CONTROL point (curve direction)'
        case 'placingControlPoint':
          return '3. Click to set END point'
        default:
          return null
      }
    } else {
      switch (placementState) {
        case 'selecting':
          return '1. Click to set START point'
        case 'dragging':
          return '2. Click to set END point'
        default:
          return null
      }
    }
  }

  const placementHint = getPlacementHint()

  return (
    <div style={styles.panel}>
      <div style={styles.title}>Track Editor</div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Objects</div>
        <div style={styles.objectGrid}>
          {OBJECT_TYPES.map(type => (
            <ObjectButton
              key={type}
              type={type}
              isSelected={selectedObjectType === type}
              onClick={() => handleSelectType(type)}
            />
          ))}
        </div>

        {/* Delete Mode Toggle */}
        <button
          style={{
            ...styles.deleteButton,
            ...(deleteMode ? styles.deleteButtonActive : styles.deleteButtonInactive),
          }}
          onClick={handleToggleDeleteMode}
        >
          {deleteMode ? 'Exit Delete Mode' : 'Delete Objects'}
        </button>

        {/* Partial Delete Mode Toggle */}
        <button
          style={{
            ...styles.deleteButton,
            ...(partialDeleteMode
              ? {
                  background: 'rgba(255, 100, 0, 0.3)',
                  borderColor: '#ff6400',
                  color: '#ff9944',
                }
              : styles.deleteButtonInactive),
          }}
          onClick={handleTogglePartialDeleteMode}
        >
          {partialDeleteMode ? 'Exit Partial Delete' : 'Partial Delete Road'}
        </button>

        {/* Show selected object info when in delete mode */}
        {deleteMode && (
          <div style={styles.placementHint}>
            Click on an object to select it, then press Delete or click the delete button below
          </div>
        )}

        {/* Show partial delete instructions */}
        {partialDeleteMode && (
          <div style={styles.placementHint}>
            {partialDeleteState
              ? '2. Click on the same road to set end point and delete segment'
              : '1. Click on a road to set start point'}
          </div>
        )}

        {/* Show selected object and delete button */}
        {selectedObject && (
          <div style={styles.selectedInfo}>
            Selected: {selectedObject.type}
            <button
              style={{
                ...styles.actionButton,
                ...styles.clearButton,
                marginTop: 6,
                width: '100%',
              }}
              onClick={handleDeleteSelected}
            >
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* Track Mode Toggle - only show for linear objects */}
      {showTrackModeToggle && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Track Shape</div>
          <div style={styles.modeToggle}>
            <button
              style={{
                ...styles.modeButton,
                ...(trackMode === 'straight' ? styles.modeButtonActive : styles.modeButtonInactive),
              }}
              onClick={() => setTrackMode('straight')}
            >
              Straight
            </button>
            <button
              style={{
                ...styles.modeButton,
                ...(trackMode === 'curve' ? styles.modeButtonActive : styles.modeButtonInactive),
              }}
              onClick={() => setTrackMode('curve')}
            >
              Curve
            </button>
          </div>
          {placementHint && <div style={styles.placementHint}>{placementHint}</div>}
        </div>
      )}

      {/* Snap Settings - only show for linear objects */}
      {showTrackModeToggle && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Snap Settings</div>
          {/* Angle Snap Toggle */}
          <div
            style={styles.snapToggle}
            onClick={() => setSnapSettings({ angleSnap: !snapSettings.angleSnap })}
          >
            <span style={styles.snapToggleLabel}>Angle Snap (15°/30°/45°/90°)</span>
            <div
              style={{
                ...styles.snapToggleSwitch,
                background: snapSettings.angleSnap ? '#22c55e' : '#444',
              }}
            >
              <div
                style={{
                  ...styles.snapToggleKnob,
                  left: snapSettings.angleSnap ? 20 : 2,
                }}
              />
            </div>
          </div>
          {/* Tangent Continuation Toggle */}
          <div
            style={styles.snapToggle}
            onClick={() => setSnapSettings({ tangentSnap: !snapSettings.tangentSnap })}
          >
            <span style={styles.snapToggleLabel}>Tangent Continuation</span>
            <div
              style={{
                ...styles.snapToggleSwitch,
                background: snapSettings.tangentSnap ? '#22c55e' : '#444',
              }}
            >
              <div
                style={{
                  ...styles.snapToggleKnob,
                  left: snapSettings.tangentSnap ? 20 : 2,
                }}
              />
            </div>
          </div>
          <div style={{ ...styles.placementHint, marginTop: 4 }}>
            Angle snap aligns roads to grid angles. Tangent continuation creates smooth curves when
            connecting to existing roads.
          </div>
        </div>
      )}

      {/* Pit Lane Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Pit Lane</div>
        {pitLaneData ? (
          <>
            <div
              style={{
                color: '#22c55e',
                fontSize: 11,
                marginBottom: 8,
                padding: '6px 8px',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: 4,
              }}
            >
              Pit lane generated
            </div>
            <button
              style={{
                ...styles.actionButton,
                ...styles.clearButton,
                width: '100%',
              }}
              onClick={clearPitLane}
            >
              Remove Pit Lane
            </button>
          </>
        ) : (
          <>
            <button
              style={{
                ...styles.actionButton,
                background: hasCheckpoint ? '#f59e0b' : '#666',
                color: '#fff',
                width: '100%',
                opacity: hasCheckpoint ? 1 : 0.5,
                cursor: hasCheckpoint ? 'pointer' : 'not-allowed',
              }}
              onClick={handleGeneratePitLane}
              disabled={!hasCheckpoint}
            >
              Generate Pit Lane
            </button>
            {!hasCheckpoint && (
              <div
                style={{
                  color: '#888',
                  fontSize: 10,
                  marginTop: 6,
                }}
              >
                Place a checkpoint first
              </div>
            )}
            {pitLaneError && (
              <div
                style={{
                  color: '#ef4444',
                  fontSize: 10,
                  marginTop: 6,
                }}
              >
                {pitLaneError}
              </div>
            )}
          </>
        )}
      </div>

      {/* Auto Curb Generation Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Auto Curbs</div>
        <button
          style={{
            ...styles.deleteButton,
            ...(autoCurbMode
              ? {
                  background: 'rgba(34, 197, 94, 0.3)',
                  borderColor: '#22c55e',
                  color: '#4ade80',
                }
              : styles.deleteButtonInactive),
          }}
          onClick={handleToggleAutoCurbMode}
        >
          {autoCurbMode ? 'Cancel Selection' : 'Select Roads for Curbs'}
        </button>

        {autoCurbMode && (
          <div style={styles.placementHint}>
            {selectedRoadIds.length > 0
              ? `${selectedRoadIds.length} road(s) selected - click Generate to add curbs`
              : 'Click on roads to select them for auto-curb generation'}
          </div>
        )}

        {autoCurbMode && selectedRoadIds.length > 0 && (
          <button
            style={{
              ...styles.actionButton,
              background: '#22c55e',
              color: '#fff',
              width: '100%',
              marginTop: 8,
            }}
            onClick={handleGenerateCurbs}
          >
            Generate Curbs
          </button>
        )}
      </div>

      {/* Track Direction Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Track Direction</div>
        {hasFlow ? (
          <>
            <div
              style={{
                color: '#22c55e',
                fontSize: 11,
                marginBottom: 8,
                padding: '6px 8px',
                background: 'rgba(34, 197, 94, 0.1)',
                borderRadius: 4,
              }}
            >
              Direction set{flowWarnings.length > 0 ? ` (${flowWarnings.length} unconnected)` : ''}
            </div>
            <button
              style={{
                ...styles.actionButton,
                ...styles.clearButton,
                width: '100%',
              }}
              onClick={clearTrackFlow}
            >
              Clear Direction
            </button>
          </>
        ) : (
          <>
            <button
              style={{
                ...styles.actionButton,
                background: hasCheckpoint ? '#3b82f6' : '#666',
                color: '#fff',
                width: '100%',
                opacity: hasCheckpoint ? 1 : 0.5,
                cursor: hasCheckpoint ? 'pointer' : 'not-allowed',
              }}
              onClick={() => setTrackFlow()}
              disabled={!hasCheckpoint}
            >
              Set Track Direction
            </button>
            {!hasCheckpoint && (
              <div style={{ color: '#888', fontSize: 10, marginTop: 6 }}>
                Place a checkpoint first
              </div>
            )}
          </>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Track</div>
        <div
          style={{
            color: isDirty ? '#fbbf24' : '#22c55e',
            fontSize: 11,
            marginBottom: 8,
            padding: '6px 8px',
            background: isDirty ? 'rgba(251, 191, 36, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            borderRadius: 4,
          }}
        >
          {isDirty ? 'Unsaved changes...' : 'All changes saved'}
        </div>
        <div style={styles.buttonRow}>
          <button
            style={{ ...styles.actionButton, ...styles.saveButton }}
            onClick={saveCurrentTrack}
          >
            Save Now
          </button>
        </div>
        <div style={{ ...styles.buttonRow, marginTop: 6 }}>
          <button
            style={{ ...styles.actionButton, ...styles.exportButton }}
            onClick={exportCurrentTrack}
          >
            Export Track
          </button>
        </div>
        <div style={{ ...styles.buttonRow, marginTop: 6 }}>
          <button
            style={{ ...styles.actionButton, ...styles.clearButton }}
            onClick={() => {
              if (window.confirm('Clear all placed objects?')) {
                clearAll()
                clearPitLane()
              }
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      <div style={styles.controls}>
        <div style={styles.controlLine}>
          <span style={styles.key}>Click</span> Place object
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>R</span> Rotate
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>Esc</span> Cancel
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>Del</span> Delete selected
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>WASD</span> Pan camera
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>Scroll</span> Zoom
        </div>
      </div>

      <div style={styles.stats}>Objects placed: {placedObjects.length}</div>
    </div>
  )
}
