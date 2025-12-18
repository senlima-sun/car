import { useEffect } from 'react'
import { useCustomizationStore, isLinearObject } from '../../../stores/useCustomizationStore'
import { useTrackStore } from '../../../stores/useTrackStore'
import ObjectToolbar from './ObjectToolbar'
import DeleteTools from './DeleteTools'
import TrackSettings from './TrackSettings'
import GenerationTools from './GenerationTools'
import TrackManagement from './TrackManagement'
import ContextHint from './ContextHint'
import EditorHelpModal from './EditorHelpModal'

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
}

export default function TrackEditorDock() {
  const selectedObjectType = useCustomizationStore(s => s.selectedObjectType)
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useCustomizationStore(s => s.selectedObjectId)
  const removeObject = useCustomizationStore(s => s.removeObject)
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
      <ContextHint />
      <div style={styles.dock}>
        {/* Objects Section */}
        <ObjectToolbar />

        <div style={styles.divider} />

        {/* Delete Tools */}
        <DeleteTools />

        {/* Track Settings - only for linear objects */}
        {showTrackSettings && (
          <>
            <div style={styles.divider} />
            <TrackSettings />
          </>
        )}

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
          <span style={styles.objectCount}>{placedObjects.length} objects</span>
          <EditorHelpModal />
        </div>
      </div>
    </>
  )
}
