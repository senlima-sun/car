import { useState, useEffect, useCallback } from 'react'
import {
  CONTROLS,
  CONTROL_CATEGORIES,
  type ControlCategory,
  type ControlDefinition,
} from '../../../constants/controls'
import { useGameStore } from '../../../stores/useGameStore'

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    background: 'rgba(0, 0, 0, 0.7)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    transition: 'background 0.2s ease',
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    zIndex: 1000,
  },
  modal: {
    background: 'rgba(20, 20, 20, 0.95)',
    borderRadius: 12,
    padding: '24px 32px',
    minWidth: 600,
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  categorySection: {
    marginBottom: 20,
    flex: 1,
  },
  twoColumnRow: {
    display: 'flex',
    gap: 24,
    marginBottom: 20,
  },
  columnDivider: {
    width: 1,
    background: 'rgba(255, 255, 255, 0.1)',
    alignSelf: 'stretch',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  categoryLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoryLock: {
    marginLeft: 'auto',
    fontSize: 10,
    padding: '2px 8px',
    borderRadius: 4,
    background: 'rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0',
    gap: 12,
  },
  keyGroup: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  keyBadge: {
    background: 'rgba(255, 255, 255, 0.15)',
    padding: '5px 10px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    minWidth: 24,
    textAlign: 'center',
    boxShadow: '0 2px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  keyBadgeDisabled: {
    opacity: 0.4,
  },
  connector: {
    flex: 1,
    height: 1,
    background:
      'repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0px, rgba(255,255,255,0.2) 4px, transparent 4px, transparent 8px)',
    minWidth: 20,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.9,
    flexShrink: 0,
  },
  actionLabelDisabled: {
    opacity: 0.4,
  },
  testingBadge: {
    fontSize: 9,
    padding: '2px 6px',
    borderRadius: 3,
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    marginLeft: 8,
  },
  closeButton: {
    width: '100%',
    marginTop: 16,
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  hint: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 12,
  },
  modeIndicator: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
  },
  modeLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  modeValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
}

interface KeyBadgeProps {
  keyName: string
  disabled?: boolean
}

function KeyBadge({ keyName, disabled }: KeyBadgeProps) {
  return (
    <span
      style={{
        ...styles.keyBadge,
        ...(disabled ? styles.keyBadgeDisabled : {}),
      }}
    >
      {keyName}
    </span>
  )
}

interface ControlRowProps {
  control: ControlDefinition
  isTestingMode: boolean
}

function ControlRow({ control, isTestingMode }: ControlRowProps) {
  const isDisabled = control.testingModeOnly && !isTestingMode

  return (
    <div style={styles.controlRow}>
      <div style={styles.keyGroup}>
        {control.keys.map((key, idx) => (
          <KeyBadge key={idx} keyName={key} disabled={isDisabled} />
        ))}
      </div>
      <div style={styles.connector} />
      <span
        style={{
          ...styles.actionLabel,
          ...(isDisabled ? styles.actionLabelDisabled : {}),
        }}
      >
        {control.displayName}
      </span>
      {control.testingModeOnly && !isTestingMode && <span style={styles.testingBadge}>TEST</span>}
    </div>
  )
}

interface CategorySectionProps {
  category: ControlCategory
  controls: ControlDefinition[]
  isTestingMode: boolean
  noMargin?: boolean
}

function CategorySection({ category, controls, isTestingMode, noMargin }: CategorySectionProps) {
  const categoryInfo = CONTROL_CATEGORIES[category]
  const isTestingCategory = category === 'testingMode'
  const isLocked = isTestingCategory && !isTestingMode

  return (
    <div style={{ ...styles.categorySection, ...(noMargin ? { marginBottom: 0 } : {}) }}>
      <div style={styles.categoryHeader}>
        <span style={{ ...styles.categoryDot, background: categoryInfo.color }} />
        <span style={{ ...styles.categoryLabel, color: categoryInfo.color }}>
          {categoryInfo.label}
        </span>
        {isLocked && <span style={styles.categoryLock}>LOCKED</span>}
      </div>
      {controls.map(control => (
        <ControlRow key={control.id} control={control} isTestingMode={isTestingMode} />
      ))}
    </div>
  )
}

const CATEGORY_ORDER: ControlCategory[] = [
  'movement',
  'drivingSystems',
  'camera',
  'racingMode',
  'testingMode',
]

export default function KeymapModal() {
  const [isOpen, setIsOpen] = useState(false)
  const isTestingMode = useGameStore(state => state.isTestingMode)

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  const controlsByCategory = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = CONTROLS.filter(c => c.category === category)
      return acc
    },
    {} as Record<ControlCategory, ControlDefinition[]>,
  )

  return (
    <>
      <button
        style={styles.trigger}
        onClick={handleToggle}
        title='Keyboard Shortcuts'
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)'
        }}
      >
        ?
      </button>

      {isOpen && (
        <div style={styles.backdrop} onClick={handleClose}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.title as React.CSSProperties}>Keyboard Shortcuts</div>

            <div style={styles.modeIndicator}>
              <span style={styles.modeLabel}>Current Mode:</span>
              <span
                style={{
                  ...styles.modeValue,
                  color: isTestingMode ? '#ef4444' : '#4ade80',
                }}
              >
                {isTestingMode ? 'TESTING' : 'RACING'}
              </span>
              <span style={styles.modeLabel}>
                ({isTestingMode ? 'all controls active' : 'press Shift+\\ to unlock testing'})
              </span>
            </div>

            {/* Movement & Driving Systems - side by side */}
            <div style={styles.twoColumnRow}>
              <CategorySection
                category='movement'
                controls={controlsByCategory['movement']}
                isTestingMode={isTestingMode}
                noMargin
              />
              <div style={styles.columnDivider} />
              <CategorySection
                category='drivingSystems'
                controls={controlsByCategory['drivingSystems']}
                isTestingMode={isTestingMode}
                noMargin
              />
            </div>

            {/* Other categories */}
            {(['camera', 'racingMode', 'testingMode'] as ControlCategory[]).map(category => (
              <CategorySection
                key={category}
                category={category}
                controls={controlsByCategory[category]}
                isTestingMode={isTestingMode}
              />
            ))}

            <button
              style={styles.closeButton}
              onClick={handleClose}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }}
            >
              Close
            </button>

            <div style={styles.hint as React.CSSProperties}>
              Press ESC or click outside to close
            </div>
          </div>
        </div>
      )}
    </>
  )
}
