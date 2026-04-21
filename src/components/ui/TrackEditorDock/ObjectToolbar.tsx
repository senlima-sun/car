import type { ObjectType } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { OBJECT_TYPES, OBJECT_CONFIGS } from '../../../constants/trackObjects'
import type { CheckpointType } from '../../../types/trackObjects'

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
  corner: '#ffcc33',
  barrier: '#888888',
  wall: '#8a8a8a',
  wall_fence: '#8a8a6a',
  road: '#333333',
  curb: '#ff0000',
  pitbox: '#ff6600',
  grass_patch: '#4a8c2a',
  gravel_patch: '#8a7d6b',
}

interface ObjectButtonProps {
  type: ObjectType
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
}

function ObjectButton({ type, isSelected, isDisabled, onClick }: ObjectButtonProps) {
  const config = OBJECT_CONFIGS[type]

  return (
    <button
      style={{
        ...styles.button,
        ...(isSelected ? styles.buttonSelected : {}),
        ...(isDisabled ? { opacity: 0.3, pointerEvents: 'none' as const } : {}),
      }}
      onClick={onClick}
      title={config.description}
      onMouseEnter={e => {
        if (!isSelected && !isDisabled) {
          ;(e.target as HTMLButtonElement).style.background = 'rgba(255, 255, 255, 0.12)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected && !isDisabled) {
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

const checkpointTypeButton: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  border: '2px solid transparent',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 'bold',
  transition: 'all 0.15s ease',
  whiteSpace: 'nowrap',
}

function CheckpointTypeSelector() {
  const checkpointPlacementType = useEditorStore(s => s.checkpointPlacementType)
  const setCheckpointPlacementType = useEditorStore(s => s.setCheckpointPlacementType)

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 4 }}>
      {([
        { type: 'start-finish' as CheckpointType, label: 'Start/Finish', activeColor: '#00ff00', activeBg: 'rgba(0, 255, 0, 0.15)' },
        { type: 'sector' as CheckpointType, label: 'Sector', activeColor: '#3b82f6', activeBg: 'rgba(59, 130, 246, 0.15)' },
      ]).map(({ type, label, activeColor, activeBg }) => (
        <button
          key={type}
          style={{
            ...checkpointTypeButton,
            ...(checkpointPlacementType === type
              ? { borderColor: activeColor, background: activeBg, color: activeColor }
              : { background: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255, 255, 255, 0.5)' }),
          }}
          onClick={() => setCheckpointPlacementType(type)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function ObjectToolbar() {
  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const selectObjectType = useEditorStore(s => s.selectObjectType)
  const deleteMode = useEditorStore(s => s.deleteMode)
  const partialDeleteMode = useEditorStore(s => s.partialDeleteMode)
  const elevationEditMode = useEditorStore(s => s.elevationEditMode)
  const autoCurbMode = useEditorStore(s => s.autoCurbMode)

  const isDisabled = deleteMode || partialDeleteMode || elevationEditMode || autoCurbMode

  const handleSelectType = (type: ObjectType) => {
    if (isDisabled) return
    selectObjectType(selectedObjectType === type ? null : type)
  }

  return (
    <div style={styles.container}>
      {OBJECT_TYPES.map(type => (
        <ObjectButton
          key={type}
          type={type}
          isSelected={selectedObjectType === type}
          isDisabled={isDisabled}
          onClick={() => handleSelectType(type)}
        />
      ))}
      {selectedObjectType === 'checkpoint' && !isDisabled && <CheckpointTypeSelector />}
    </div>
  )
}
