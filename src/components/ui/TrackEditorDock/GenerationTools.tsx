import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { generateCurbsForRoads } from '../../../utils/autoCurbGenerator'

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
}

export default function GenerationTools() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const addGeneratedCurbs = useCustomizationStore(s => s.addGeneratedCurbs)
  const autoCurbMode = useEditorStore(s => s.autoCurbMode)
  const selectedRoadIds = useEditorStore(s => s.selectedRoadIds)
  const setAutoCurbMode = useEditorStore(s => s.setAutoCurbMode)
  const clearRoadSelection = useEditorStore(s => s.clearRoadSelection)
  const deleteMode = useEditorStore(s => s.deleteMode)
  const partialDeleteMode = useEditorStore(s => s.partialDeleteMode)
  const selectObjectType = useEditorStore(s => s.selectObjectType)
  const setDeleteMode = useEditorStore(s => s.setDeleteMode)
  const setPartialDeleteMode = useEditorStore(s => s.setPartialDeleteMode)

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
      {/* Auto Curbs Button */}
      <button
        style={{
          ...styles.button,
          ...(autoCurbMode ? styles.buttonActive : {}),
        }}
        onClick={handleToggleAutoCurbMode}
        title={autoCurbMode ? 'Cancel curb selection' : 'Select roads for auto curbs'}
      >
        <svg
          width='14'
          height='14'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
        >
          <path d='M3 6l3-3 3 3M3 6v12l3 3 3-3V6' />
          <path d='M15 6l3-3 3 3M15 6v12l3 3 3-3V6' />
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
