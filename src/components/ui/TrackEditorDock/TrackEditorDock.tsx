import { useEffect } from 'react'
import { useCustomizationStore, isLinearObject } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import ObjectToolbar from './ObjectToolbar'
import DeleteTools from './DeleteTools'
import TrackSettings from './TrackSettings'
import GenerationTools from './GenerationTools'
import ElevationTools from './ElevationTools'
import TrackManagement from './TrackManagement'
import ContextHint from './ContextHint'

const styles: Record<string, React.CSSProperties> = {
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    background: 'rgba(0, 0, 0, 0.85)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    gap: 0,
    pointerEvents: 'auto',
    zIndex: 100,
  },
  secondaryBar: {
    position: 'absolute',
    bottom: 64,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'auto',
    zIndex: 100,
  },
  divider: {
    width: 1,
    height: 32,
    background: 'rgba(255, 255, 255, 0.1)',
    margin: '0 8px',
    flexShrink: 0,
  },
  spacer: {
    flex: 1,
  },
  utilitySection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  objectCount: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  undoRedoButton: {
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
  undoRedoDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },
}

export default function TrackEditorDock() {
  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const removeObject = useCustomizationStore(s => s.removeObject)
  const canUndo = useEditorStore(s => s.canUndo)
  const canRedo = useEditorStore(s => s.canRedo)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const undoDescription = useEditorStore(s => s.undoDescription)
  const redoDescription = useEditorStore(s => s.redoDescription)
  const markDirty = useTrackStore(s => s.markDirty)
  const isDirty = useTrackStore(s => s.isDirty)
  const saveCurrentTrack = useTrackStore(s => s.saveCurrentTrack)

  // Show track settings only for linear objects
  const showTrackSettings = selectedObjectType && isLinearObject(selectedObjectType)

  // Mark track as dirty when objects change
  useEffect(() => {
    markDirty()
  }, [placedObjects, markDirty])

  // Auto-save with debounce
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      saveCurrentTrack()
    }, 2000)
    return () => clearTimeout(timer)
  }, [placedObjects, isDirty, saveCurrentTrack])

  // Handle Delete/Backspace key to delete selected object
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId) {
        if (e.key === 'Backspace' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault()
        }
        removeObject(selectedObjectId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjectId, removeObject])

  return (
    <>
      <ContextHint showSecondaryBar={!!showTrackSettings} />
      {showTrackSettings && (
        <div style={styles.secondaryBar}>
          <TrackSettings />
        </div>
      )}
      <div style={styles.dock}>
        {/* Objects Section */}
        <ObjectToolbar />

        <div style={styles.divider} />

        {/* Delete Tools */}
        <DeleteTools />

        <div style={styles.divider} />

        {/* Elevation Tools */}
        <ElevationTools />

        <div style={styles.divider} />

        {/* Generation Tools */}
        <GenerationTools />

        <div style={styles.divider} />

        {/* Track Management */}
        <TrackManagement />

        {/* Spacer */}
        <div style={styles.spacer} />

        {/* Utility Section */}
        <div style={styles.utilitySection}>
          <button
            style={{
              ...styles.undoRedoButton,
              ...(!canUndo ? styles.undoRedoDisabled : {}),
            }}
            onClick={canUndo ? undo : undefined}
            title={undoDescription ? `Undo: ${undoDescription}` : 'Nothing to undo'}
          >
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke={canUndo ? '#fff' : '#666'}
              strokeWidth='2'
            >
              <path d='M3 10h10a5 5 0 015 5v2' />
              <polyline points='7 14 3 10 7 6' />
            </svg>
          </button>
          <button
            style={{
              ...styles.undoRedoButton,
              ...(!canRedo ? styles.undoRedoDisabled : {}),
            }}
            onClick={canRedo ? redo : undefined}
            title={redoDescription ? `Redo: ${redoDescription}` : 'Nothing to redo'}
          >
            <svg
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke={canRedo ? '#fff' : '#666'}
              strokeWidth='2'
            >
              <path d='M21 10H11a5 5 0 00-5 5v2' />
              <polyline points='17 14 21 10 17 6' />
            </svg>
          </button>
          <span style={styles.objectCount}>{placedObjects.length} objects</span>
        </div>
      </div>
    </>
  )
}
