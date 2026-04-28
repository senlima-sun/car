import { useEffect } from 'react'
import {
  useCustomizationStore,
  type ObjectType,
  isLinearObject,
} from '../../../stores/useCustomizationStore'
import { isCurveMode, isPolygonObject, isWallType } from '../../../types/trackObjects'
import WallPropertiesPanel from './WallPropertiesPanel'
import { useEditorStore } from '../../../stores/useEditorStore'
import { useElevationEditStore } from '../../../stores/useElevationEditStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import { useTrackGraphStore } from '../../../stores/useTrackGraphStore'
import { OBJECT_TYPES } from '../../../constants/trackObjects'
import { generateCurbsForRoads } from '../../../utils/autoCurbGenerator'
import ObjectButton from './ObjectButton'
import TrackValidationPanel from './TrackValidationPanel'
import { smoothElevations } from '../../../utils/elevationHandles'
import { editorCommandStack } from '../../../utils/commandStack'
import type { EditorCommand } from '../../../types/editor'

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
  const updateObject = useCustomizationStore(s => s.updateObject)

  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const trackMode = useEditorStore(s => s.trackMode)
  const placementState = useEditorStore(s => s.placementState)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const deleteMode = useEditorStore(s => s.deleteMode)
  const polygonPoints = useEditorStore(s => s.polygonPoints)
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
  const multiSelectedIds = useEditorStore(s => s.multiSelectedIds)
  const deleteMultiSelected = useEditorStore(s => s.deleteMultiSelected)
  const clearMultiSelection = useEditorStore(s => s.clearMultiSelection)
  const checkpointPlacementType = useEditorStore(s => s.checkpointPlacementType)
  const setCheckpointPlacementType = useEditorStore(s => s.setCheckpointPlacementType)
  const symmetricCurve = useEditorStore(s => s.symmetricCurve)
  const setSymmetricCurve = useEditorStore(s => s.setSymmetricCurve)
  const elevationEditMode = useEditorStore(s => s.elevationEditMode)
  const setElevationEditMode = useEditorStore(s => s.setElevationEditMode)
  const elevationTool = useElevationEditStore(s => s.elevationTool)
  const setElevationTool = useElevationEditStore(s => s.setElevationTool)
  const targetLevelHeight = useElevationEditStore(s => s.targetLevelHeight)
  const setTargetLevelHeight = useElevationEditStore(s => s.setTargetLevelHeight)
  const slopeAnchor = useElevationEditStore(s => s.slopeAnchor)
  const smoothSelectedRoadIds = useElevationEditStore(s => s.smoothSelectedRoadIds)
  const clearSmoothSelection = useElevationEditStore(s => s.clearSmoothSelection)
  const propagateToNeighbors = useElevationEditStore(s => s.propagateToNeighbors)
  const setPropagateToNeighbors = useElevationEditStore(s => s.setPropagateToNeighbors)
  const reorderSectorCheckpoint = useEditorStore(s => s.reorderSectorCheckpoint)
  const deleteSectorCheckpoint = useEditorStore(s => s.deleteSectorCheckpoint)
  const selectObject = useEditorStore(s => s.selectObject)

  // Track store
  const saveCurrentTrack = useTrackStore(s => s.saveCurrentTrack)
  const exportCurrentTrack = useTrackStore(s => s.exportCurrentTrack)
  const markDirty = useTrackStore(s => s.markDirty)
  const isDirty = useTrackStore(s => s.isDirty)

  // Track direction
  const hasFlow = useTrackGraphStore(s => s.hasFlow)
  const flowWarnings = useTrackGraphStore(s => s.flowWarnings)
  const setTrackFlow = useTrackGraphStore(s => s.setTrackFlow)
  const clearTrackFlow = useTrackGraphStore(s => s.clearTrackFlow)
  const flipRoadDirection = useTrackGraphStore(s => s.flipRoadDirection)

  // Check if checkpoint exists
  const checkpoint = placedObjects.find(obj => obj.type === 'checkpoint')
  const hasCheckpoint = !!checkpoint

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
        if (e.key === 'Backspace' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault()
        }
        const obj = placedObjects.find(o => o.id === selectedObjectId)
        if (obj?.type === 'checkpoint' && obj.checkpointType === 'sector') {
          deleteSectorCheckpoint(selectedObjectId)
        } else {
          removeObject(selectedObjectId)
          selectObject(null)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjectId, removeObject, deleteSectorCheckpoint, placedObjects, selectObject])

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
    if (!selectedObjectId) return
    const obj = placedObjects.find(o => o.id === selectedObjectId)
    if (obj?.type === 'checkpoint' && obj.checkpointType === 'sector') {
      deleteSectorCheckpoint(selectedObjectId)
    } else {
      removeObject(selectedObjectId)
      selectObject(null)
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

  const selectedObject = selectedObjectId
    ? placedObjects.find(obj => obj.id === selectedObjectId)
    : null

  const isSectorCheckpoint =
    selectedObject?.type === 'checkpoint' && selectedObject.checkpointType === 'sector'

  const sectorCheckpoints = placedObjects
    .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
    .sort((a, b) => (a.checkpointOrder ?? 0) - (b.checkpointOrder ?? 0))

  const sectorIndex = isSectorCheckpoint
    ? sectorCheckpoints.findIndex(s => s.id === selectedObject.id)
    : -1

  // Check if current selected object is a linear type (road/barrier)
  const showTrackModeToggle = selectedObjectType && isLinearObject(selectedObjectType)

  // Get placement hint based on current state
  const getPlacementHint = () => {
    if (!selectedObjectType) return null

    if (isPolygonObject(selectedObjectType)) {
      if (placementState === 'polygonDrawing') {
        const points = polygonPoints.length
        if (points === 0) {
          return 'Click to add first point'
        } else if (points === 1) {
          return `1 point placed • Click to add more points`
        } else if (points === 2) {
          return `${points} points • Click to add more • Need at least 3 points`
        } else {
          return `${points} points • Double-click or Enter to close • Backspace to undo • Esc to cancel`
        }
      }
      return 'Click to start drawing polygon • Double-click or Enter to close'
    }

    if (!isLinearObject(selectedObjectType)) return 'Click to place'

    if (isCurveMode(trackMode)) {
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

        {/* Show polygon drawing hint */}
        {selectedObjectType && isPolygonObject(selectedObjectType) && placementHint && (
          <div style={styles.placementHint}>{placementHint}</div>
        )}

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

        {selectedObject && !isSectorCheckpoint && (
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

        {selectedObject && isWallType(selectedObject.type) && !deleteMode && (
          <WallPropertiesPanel />
        )}

        {isSectorCheckpoint && selectedObject && (
          <div
            style={{
              padding: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              borderRadius: 6,
              marginTop: 6,
            }}
          >
            <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
              Sector S{selectedObject.checkpointOrder ?? '?'}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                style={{
                  ...styles.actionButton,
                  background: sectorIndex <= 0 ? '#333' : '#3b82f6',
                  color: sectorIndex <= 0 ? '#666' : '#fff',
                  flex: 1,
                  cursor: sectorIndex <= 0 ? 'not-allowed' : 'pointer',
                  opacity: sectorIndex <= 0 ? 0.5 : 1,
                }}
                disabled={sectorIndex <= 0}
                onClick={() => reorderSectorCheckpoint(selectedObject.id, 'up')}
              >
                Move Up
              </button>
              <button
                style={{
                  ...styles.actionButton,
                  background: sectorIndex >= sectorCheckpoints.length - 1 ? '#333' : '#3b82f6',
                  color: sectorIndex >= sectorCheckpoints.length - 1 ? '#666' : '#fff',
                  flex: 1,
                  cursor: sectorIndex >= sectorCheckpoints.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: sectorIndex >= sectorCheckpoints.length - 1 ? 0.5 : 1,
                }}
                disabled={sectorIndex >= sectorCheckpoints.length - 1}
                onClick={() => reorderSectorCheckpoint(selectedObject.id, 'down')}
              >
                Move Down
              </button>
            </div>
            <button
              style={{
                ...styles.actionButton,
                ...styles.clearButton,
                width: '100%',
              }}
              onClick={() => deleteSectorCheckpoint(selectedObject.id)}
            >
              Delete Sector
            </button>
            <div style={{ color: '#888', fontSize: 10, marginTop: 6 }}>
              Drag handles to reposition. Esc to cancel drag.
            </div>
          </div>
        )}

        {multiSelectedIds.length > 0 && (
          <div style={styles.selectedInfo}>
            {multiSelectedIds.length} objects selected (Shift+Click)
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                style={{
                  ...styles.actionButton,
                  ...styles.clearButton,
                  flex: 1,
                }}
                onClick={deleteMultiSelected}
              >
                Delete All
              </button>
              <button
                style={{
                  ...styles.actionButton,
                  background: '#666',
                  color: '#fff',
                  flex: 1,
                }}
                onClick={clearMultiSelection}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Checkpoint Type Selector */}
      {selectedObjectType === 'checkpoint' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Checkpoint Type</div>
          <div style={styles.modeToggle}>
            <button
              style={{
                ...styles.modeButton,
                ...(checkpointPlacementType === 'start-finish'
                  ? styles.modeButtonActive
                  : styles.modeButtonInactive),
              }}
              onClick={() => setCheckpointPlacementType('start-finish')}
            >
              Start/Finish
            </button>
            <button
              style={{
                ...styles.modeButton,
                ...(checkpointPlacementType === 'sector'
                  ? {
                      background: 'rgba(59, 130, 246, 0.2)',
                      borderColor: '#3b82f6',
                      color: '#3b82f6',
                    }
                  : styles.modeButtonInactive),
              }}
              onClick={() => setCheckpointPlacementType('sector')}
            >
              Sector
            </button>
          </div>
          <div style={styles.placementHint}>
            {checkpointPlacementType === 'start-finish'
              ? 'Only one start/finish line allowed. Replaces existing.'
              : `Sector ${placedObjects.filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector').length + 1} — placed in order along track.`}
          </div>
          <div style={styles.placementHint}>Click on a road to place checkpoint across it</div>
        </div>
      )}

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
                ...(isCurveMode(trackMode) ? styles.modeButtonActive : styles.modeButtonInactive),
              }}
              onClick={() => setTrackMode('curve')}
            >
              Curve
            </button>
          </div>
          {isCurveMode(trackMode) && (
            <div style={styles.snapToggle} onClick={() => setSymmetricCurve(!symmetricCurve)}>
              <span style={styles.snapToggleLabel}>Symmetric Curve</span>
              <div
                style={{
                  ...styles.snapToggleSwitch,
                  background: symmetricCurve ? '#22c55e' : '#444',
                }}
              >
                <div
                  style={{
                    ...styles.snapToggleKnob,
                    left: symmetricCurve ? 20 : 2,
                  }}
                />
              </div>
            </div>
          )}
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

      {/* Elevation Edit Mode Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Elevation</div>
        <button
          style={{
            ...styles.deleteButton,
            ...(elevationEditMode
              ? {
                  background: 'rgba(59, 130, 246, 0.3)',
                  borderColor: '#3b82f6',
                  color: '#60a5fa',
                }
              : styles.deleteButtonInactive),
          }}
          onClick={() => {
            if (elevationEditMode) {
              setElevationEditMode(false)
            } else {
              if (deleteMode) setDeleteMode(false)
              if (partialDeleteMode) setPartialDeleteMode(false)
              if (autoCurbMode) {
                clearRoadSelection()
                setAutoCurbMode(false)
              }
              setElevationEditMode(true)
            }
          }}
        >
          {elevationEditMode ? 'Exit Elevation Mode' : 'Edit Elevation (Y)'}
        </button>

        {elevationEditMode && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 4,
                marginBottom: 8,
              }}
            >
              {[
                { tool: 'raise' as const, label: 'Raise' },
                { tool: 'level' as const, label: 'Level' },
                { tool: 'slope' as const, label: 'Slope' },
                { tool: 'smooth' as const, label: 'Smooth' },
              ].map(({ tool, label }) => (
                <button
                  key={tool}
                  style={{
                    ...styles.modeButton,
                    ...(elevationTool === tool
                      ? {
                          background: 'rgba(59, 130, 246, 0.2)',
                          borderColor: '#3b82f6',
                          color: '#3b82f6',
                        }
                      : styles.modeButtonInactive),
                  }}
                  onClick={() => setElevationTool(tool)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              style={styles.snapToggle}
              onClick={() => setPropagateToNeighbors(!propagateToNeighbors)}
            >
              <span style={styles.snapToggleLabel}>Propagate to neighbors</span>
              <div
                style={{
                  ...styles.snapToggleSwitch,
                  background: propagateToNeighbors ? '#22c55e' : '#444',
                }}
              >
                <div
                  style={{
                    ...styles.snapToggleKnob,
                    left: propagateToNeighbors ? 20 : 2,
                  }}
                />
              </div>
            </div>

            {elevationTool === 'raise' && (
              <div style={styles.placementHint}>
                Click and drag road endpoints up/down to change elevation.
              </div>
            )}

            {elevationTool === 'level' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#aaa', fontSize: 11, minWidth: 50 }}>Height</span>
                  <input
                    type='range'
                    min={0}
                    max={20}
                    step={0.25}
                    value={targetLevelHeight}
                    onChange={e => setTargetLevelHeight(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#3b82f6' }}
                  />
                  <span
                    style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace', minWidth: 36 }}
                  >
                    {targetLevelHeight.toFixed(1)}m
                  </span>
                </div>
                <div style={styles.placementHint}>
                  Click endpoints to set to target height. Shift+Click sets both endpoints.
                </div>
              </>
            )}

            {elevationTool === 'slope' && (
              <div style={styles.placementHint}>
                {slopeAnchor
                  ? `Anchor set at ${slopeAnchor.height.toFixed(1)}m. Click second endpoint.`
                  : 'Click first endpoint to set slope anchor.'}
              </div>
            )}

            {elevationTool === 'smooth' && (
              <>
                <div style={styles.placementHint}>
                  {smoothSelectedRoadIds.length > 0
                    ? `${smoothSelectedRoadIds.length} road(s) selected. Click Apply or press Enter.`
                    : 'Click roads to select for smoothing.'}
                </div>
                {smoothSelectedRoadIds.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      style={{
                        ...styles.actionButton,
                        background: '#3b82f6',
                        color: '#fff',
                        flex: 1,
                      }}
                      onClick={() => {
                        const customStore = useCustomizationStore.getState()
                        const result = smoothElevations(
                          smoothSelectedRoadIds,
                          customStore.placedObjects,
                          1,
                        )
                        const before = new Map<
                          string,
                          { startElevation: number; endElevation: number }
                        >()
                        for (const [id] of result) {
                          const obj = customStore.placedObjects.find(o => o.id === id)
                          if (obj) {
                            before.set(id, {
                              startElevation: obj.startElevation ?? 0,
                              endElevation: obj.endElevation ?? 0,
                            })
                          }
                        }
                        const resultCopy = new Map(result)
                        const beforeCopy = new Map(before)
                        const command: EditorCommand = {
                          execute: () => {
                            const store = useCustomizationStore.getState()
                            for (const [id, vals] of resultCopy) {
                              store.updateObject(id, vals)
                            }
                          },
                          undo: () => {
                            const store = useCustomizationStore.getState()
                            for (const [id, vals] of beforeCopy) {
                              store.updateObject(id, vals)
                            }
                          },
                          description: 'Smooth elevations',
                        }
                        editorCommandStack.push(command)
                        clearSmoothSelection()
                      }}
                    >
                      Apply
                    </button>
                    <button
                      style={{
                        ...styles.actionButton,
                        background: '#666',
                        color: '#fff',
                        flex: 1,
                      }}
                      onClick={clearSmoothSelection}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </>
            )}
          </>
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
            {(() => {
              const selectedRoads =
                multiSelectedIds.length > 0
                  ? multiSelectedIds.filter(
                      id => placedObjects.find(o => o.id === id)?.type === 'road',
                    )
                  : selectedObject?.type === 'road'
                    ? [selectedObject.id]
                    : []
              const hasSelectedRoads = selectedRoads.length > 0
              return hasSelectedRoads ? (
                <button
                  style={{
                    ...styles.actionButton,
                    background: '#f97316',
                    color: '#fff',
                    width: '100%',
                    marginBottom: 6,
                  }}
                  onClick={() => flipRoadDirection(selectedRoads)}
                >
                  Flip Direction ({selectedRoads.length} road{selectedRoads.length > 1 ? 's' : ''})
                </button>
              ) : null
            })()}
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

      {/* Road Width - show when road is selected */}
      {selectedObject && selectedObject.type === 'road' && !deleteMode && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Road Width</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type='range'
              min={8}
              max={24}
              step={2}
              value={selectedObject.width ?? 12}
              onChange={e => updateObject(selectedObject.id, { width: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace', minWidth: 28 }}>
              {selectedObject.width ?? 12}
            </span>
          </div>
        </div>
      )}

      {/* Elevation - show when road is selected */}
      {selectedObject && selectedObject.type === 'road' && !deleteMode && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Elevation</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#aaa', fontSize: 11, minWidth: 80 }}>Start Height</span>
            <input
              type='range'
              min={0}
              max={20}
              step={0.5}
              value={selectedObject.startElevation ?? 0}
              onChange={e =>
                updateObject(selectedObject.id, { startElevation: Number(e.target.value) })
              }
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace', minWidth: 36 }}>
              {(selectedObject.startElevation ?? 0).toFixed(1)}m
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ color: '#aaa', fontSize: 11, minWidth: 80 }}>End Height</span>
            <input
              type='range'
              min={0}
              max={20}
              step={0.5}
              value={selectedObject.endElevation ?? 0}
              onChange={e =>
                updateObject(selectedObject.id, { endElevation: Number(e.target.value) })
              }
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace', minWidth: 36 }}>
              {(selectedObject.endElevation ?? 0).toFixed(1)}m
            </span>
          </div>
          {isCurveMode(selectedObject.trackMode) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#aaa', fontSize: 11, minWidth: 80 }}>Banking</span>
              <input
                type='range'
                min={-30}
                max={30}
                step={5}
                value={selectedObject.banking ?? 0}
                onChange={e => updateObject(selectedObject.id, { banking: Number(e.target.value) })}
                style={{ flex: 1, accentColor: '#3b82f6' }}
              />
              <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace', minWidth: 36 }}>
                {(selectedObject.banking ?? 0).toFixed(0)}°
              </span>
            </div>
          )}
        </div>
      )}

      <TrackValidationPanel />

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
          <span style={styles.key}>Right drag</span> Rotate
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>Mid drag</span> Pan
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>Scroll</span> Zoom
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>Q/E</span> Rotate 45°
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>1/2/3</span> View presets
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>Y</span> Elevation mode
        </div>
        <div style={styles.controlLine}>
          <span style={styles.key}>B</span> Elevation profile
        </div>
      </div>

      <div
        style={{
          ...styles.stats,
          color: placedObjects.length > 200 ? '#f59e0b' : '#666',
        }}
      >
        Objects: {placedObjects.length}
        {placedObjects.length > 200 && ' (performance may be affected)'}
      </div>
    </div>
  )
}
