import type { ObjectType } from '../../../stores/useCustomizationStore'
import { OBJECT_CONFIGS } from '../../../constants/trackObjects'

interface ObjectButtonProps {
  type: ObjectType
  isSelected: boolean
  onClick: () => void
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 8px',
    border: '2px solid transparent',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: 70,
  },
  buttonSelected: {
    borderColor: '#00ff00',
    background: 'rgba(0, 255, 0, 0.2)',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: '#fff',
    textAlign: 'center' as const,
  },
}

// Simple colored squares as icons for each object type
const objectIcons: Record<ObjectType, string> = {
  cone: '#ff6b00',
  ramp: '#666666',
  checkpoint: '#00ff00',
  barrier: '#888888',
  road: '#333333',
  curb: '#ff0000',
}

export default function ObjectButton({ type, isSelected, onClick }: ObjectButtonProps) {
  const config = OBJECT_CONFIGS[type]

  return (
    <button
      style={{
        ...styles.button,
        ...(isSelected ? styles.buttonSelected : {}),
      }}
      onClick={onClick}
      title={config.description}
    >
      <div
        style={{
          ...styles.icon,
          backgroundColor: objectIcons[type],
          border: '1px solid rgba(255,255,255,0.3)',
        }}
      />
      <span style={styles.label}>{config.label}</span>
    </button>
  )
}
