import { useCustomizationStore } from '../../../stores/useCustomizationStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid transparent',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    padding: 0,
    fontSize: 16,
  },
  deleteActive: {
    borderColor: '#dc2626',
    background: 'rgba(220, 38, 38, 0.2)',
  },
  partialActive: {
    borderColor: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.2)',
  },
  deleteSelectedBtn: {
    height: 32,
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 6,
    background: '#dc2626',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: 11,
    fontWeight: 'bold',
    gap: 6,
    marginLeft: 4,
  },
}

export default function DeleteTools() {
  const deleteMode = useCustomizationStore(s => s.deleteMode)
  const partialDeleteMode = useCustomizationStore(s => s.partialDeleteMode)
  const selectedObjectId = useCustomizationStore(s => s.selectedObjectId)
  const selectObjectType = useCustomizationStore(s => s.selectObjectType)
  const setDeleteMode = useCustomizationStore(s => s.setDeleteMode)
  const setPartialDeleteMode = useCustomizationStore(s => s.setPartialDeleteMode)
  const cancelPartialDelete = useCustomizationStore(s => s.cancelPartialDelete)
  const removeObject = useCustomizationStore(s => s.removeObject)

  const handleToggleDeleteMode = () => {
    if (partialDeleteMode) setPartialDeleteMode(false)
    if (deleteMode) {
      setDeleteMode(false)
    } else {
      selectObjectType(null)
      setDeleteMode(true)
    }
  }

  const handleTogglePartialDeleteMode = () => {
    if (deleteMode) setDeleteMode(false)
    if (partialDeleteMode) {
      cancelPartialDelete()
      setPartialDeleteMode(false)
    } else {
      selectObjectType(null)
      setPartialDeleteMode(true)
    }
  }

  const handleDeleteSelected = () => {
    if (selectedObjectId) {
      removeObject(selectedObjectId)
    }
  }

  return (
    <div style={styles.container}>
      {/* Delete Mode Toggle */}
      <button
        style={{
          ...styles.button,
          ...(deleteMode ? styles.deleteActive : {}),
        }}
        onClick={handleToggleDeleteMode}
        title={deleteMode ? 'Exit delete mode' : 'Delete objects'}
      >
        <svg
          width='18'
          height='18'
          viewBox='0 0 24 24'
          fill='none'
          stroke={deleteMode ? '#ff6b6b' : '#888'}
          strokeWidth='2'
        >
          <path d='M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2' />
          <line x1='10' y1='11' x2='10' y2='17' />
          <line x1='14' y1='11' x2='14' y2='17' />
        </svg>
      </button>

      {/* Partial Delete Mode Toggle */}
      <button
        style={{
          ...styles.button,
          ...(partialDeleteMode ? styles.partialActive : {}),
        }}
        onClick={handleTogglePartialDeleteMode}
        title={partialDeleteMode ? 'Exit partial delete' : 'Partial delete road'}
      >
        <svg
          width='18'
          height='18'
          viewBox='0 0 24 24'
          fill='none'
          stroke={partialDeleteMode ? '#fbbf24' : '#888'}
          strokeWidth='2'
        >
          <circle cx='6' cy='6' r='3' />
          <circle cx='18' cy='18' r='3' />
          <line x1='8.5' y1='8.5' x2='15.5' y2='15.5' strokeDasharray='3 2' />
        </svg>
      </button>

      {/* Delete Selected Button - appears when object is selected */}
      {selectedObjectId && (
        <button
          style={styles.deleteSelectedBtn}
          onClick={handleDeleteSelected}
          title='Delete selected object'
        >
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <path d='M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2' />
          </svg>
          Delete
        </button>
      )}
    </div>
  )
}
