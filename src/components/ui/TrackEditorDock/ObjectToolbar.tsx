import type { ObjectType } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { OBJECT_TYPES, OBJECT_CONFIGS } from '../../../constants/trackObjects'

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
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid transparent',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    padding: 0,
  },
  buttonHover: {
    background: 'rgba(255, 255, 255, 0.12)',
  },
  buttonSelected: {
    borderColor: '#00ff00',
    background: 'rgba(0, 255, 0, 0.15)',
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 3,
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  label: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
}

const objectColors: Record<ObjectType, string> = {
  cone: '#ff6b00',
  ramp: '#666666',
  checkpoint: '#00ff00',
  barrier: '#888888',
  road: '#333333',
  curb: '#ff0000',
  pitbox: '#ff6600',
}

interface ObjectButtonProps {
  type: ObjectType
  isSelected: boolean
  onClick: () => void
}

function ObjectButton({ type, isSelected, onClick }: ObjectButtonProps) {
  const config = OBJECT_CONFIGS[type]

  return (
    <button
      style={{
        ...styles.button,
        ...(isSelected ? styles.buttonSelected : {}),
      }}
      onClick={onClick}
      title={config.description}
      onMouseEnter={e => {
        if (!isSelected) {
          ;(e.target as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.12)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          ;(e.target as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.08)'
        }
      }}
    >
      <div
        style={{
          ...styles.icon,
          backgroundColor: objectColors[type],
        }}
      />
      <span style={styles.label}>{config.label.slice(0, 4)}</span>
    </button>
  )
}

export default function ObjectToolbar() {
  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const selectObjectType = useEditorStore(s => s.selectObjectType)
  const deleteMode = useEditorStore(s => s.deleteMode)
  const partialDeleteMode = useEditorStore(s => s.partialDeleteMode)
  const setDeleteMode = useEditorStore(s => s.setDeleteMode)
  const setPartialDeleteMode = useEditorStore(s => s.setPartialDeleteMode)

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

  return (
    <div style={styles.container}>
      {OBJECT_TYPES.map(type => (
        <ObjectButton
          key={type}
          type={type}
          isSelected={selectedObjectType === type}
          onClick={() => handleSelectType(type)}
        />
      ))}
    </div>
  )
}
