import { useState, useEffect, useCallback } from 'react'

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
    minWidth: 320,
    maxWidth: '90vw',
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: 4,
  },
  controlRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    color: '#fff',
    fontSize: 13,
  },
  key: {
    background: 'rgba(255, 255, 255, 0.15)',
    padding: '4px 10px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 60,
    textAlign: 'center',
  },
  action: {
    opacity: 0.9,
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
}

interface ControlItem {
  key: string
  action: string
}

const DRIVING_CONTROLS: ControlItem[] = [
  { key: 'W', action: 'Accelerate' },
  { key: 'S', action: 'Brake / Reverse' },
  { key: 'A / D', action: 'Steer Left / Right' },
  { key: 'SPACE', action: 'Handbrake' },
  { key: 'E', action: 'DRS (Speed Boost)' },
]

const GAME_CONTROLS: ControlItem[] = [
  { key: 'C', action: 'Toggle Camera' },
  { key: 'Q', action: 'Cycle Weather' },
  { key: 'R', action: 'Start/Stop Lap Timer' },
  { key: 'T', action: 'Toggle Track Editor' },
  { key: 'P', action: 'Pit Stop (in pit box)' },
  { key: 'ESC', action: 'Cancel / Close' },
]

export default function ControlsModal() {
  const [isOpen, setIsOpen] = useState(false)

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  // Handle ESC key to close modal
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

  return (
    <>
      {/* Trigger Button */}
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

      {/* Modal */}
      {isOpen && (
        <div style={styles.backdrop} onClick={handleClose}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.title as React.CSSProperties}>Keyboard Shortcuts</div>

            {/* Driving Controls */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Driving</div>
              {DRIVING_CONTROLS.map(control => (
                <div key={control.key} style={styles.controlRow}>
                  <span style={styles.action}>{control.action}</span>
                  <span style={styles.key}>{control.key}</span>
                </div>
              ))}
            </div>

            {/* Game Controls */}
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Game</div>
              {GAME_CONTROLS.map(control => (
                <div key={control.key} style={styles.controlRow}>
                  <span style={styles.action}>{control.action}</span>
                  <span style={styles.key}>{control.key}</span>
                </div>
              ))}
            </div>

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
