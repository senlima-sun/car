import { useState, useCallback, useEffect } from 'react'
import { useTouchControlsStore } from '../../../stores/useTouchControlsStore'
import { useMobileDetection } from '../../../utils/isMobile'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    pointerEvents: 'none',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: '0 20px 30px 20px',
  },
  brakeArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  dpadArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 10,
    border: '2px solid rgba(255, 255, 255, 0.4)',
    background: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    WebkitTouchCallout: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
  } as React.CSSProperties,
  buttonActive: {
    background: 'rgba(255, 255, 255, 0.3)',
    borderColor: '#00ff88',
  },
  brakeButton: {
    width: 80,
    height: 80,
    borderRadius: 14,
    background: 'rgba(255, 50, 50, 0.5)',
    borderColor: 'rgba(255, 100, 100, 0.6)',
    fontSize: 14,
  },
  brakeButtonActive: {
    background: 'rgba(255, 100, 100, 0.7)',
    borderColor: '#ff4444',
  },
  dpadRow: {
    display: 'flex',
    gap: 4,
  },
  dpadCenter: {
    width: 60,
    height: 60,
    background: 'transparent',
    border: 'none',
    pointerEvents: 'none',
  },
}

// D-pad layout:
// [RF][F][LF]  (top row: Right-Forward, Forward, Left-Forward)
// [R ][ ][L ]  (bottom row: Right only, empty, Left only)

type ButtonType = 'brake' | 'forward' | 'forward-left' | 'forward-right' | 'left' | 'right'

export default function MobileControls() {
  const isMobile = useMobileDetection()
  const store = useTouchControlsStore

  // Active state for visual feedback
  const [activeButtons, setActiveButtons] = useState<Set<ButtonType>>(new Set())

  // Prevent context menu on long press
  const preventContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
  }, [])

  const handleTouchStart = useCallback(
    (button: ButtonType) => (e: React.TouchEvent) => {
      e.preventDefault()
      setActiveButtons(prev => new Set(prev).add(button))

      const state = store.getState()
      switch (button) {
        case 'brake':
          state.setBrake(true)
          break
        case 'forward':
          state.setForward(true)
          break
        case 'forward-left':
          state.setForwardLeft(true)
          break
        case 'forward-right':
          state.setForwardRight(true)
          break
        case 'left':
          state.setLeft(true)
          break
        case 'right':
          state.setRight(true)
          break
      }
    },
    []
  )

  const handleTouchEnd = useCallback(
    (button: ButtonType) => (e: React.TouchEvent) => {
      e.preventDefault()
      setActiveButtons(prev => {
        const next = new Set(prev)
        next.delete(button)
        return next
      })

      const state = store.getState()
      switch (button) {
        case 'brake':
          state.setBrake(false)
          break
        case 'forward':
          state.setForward(false)
          break
        case 'forward-left':
        case 'forward-right':
          state.setForward(false)
          state.setLeft(false)
          state.setRight(false)
          break
        case 'left':
          state.setLeft(false)
          break
        case 'right':
          state.setRight(false)
          break
      }
    },
    []
  )

  // Reset all controls when component unmounts or device changes
  useEffect(() => {
    return () => {
      store.getState().resetAll()
    }
  }, [])

  if (!isMobile) return null

  const isActive = (btn: ButtonType) => activeButtons.has(btn)

  return (
    <div style={styles.container}>
      {/* Left side - Brake button */}
      <div style={styles.brakeArea as React.CSSProperties}>
        <button
          style={{
            ...styles.button,
            ...styles.brakeButton,
            ...(isActive('brake') ? styles.brakeButtonActive : {}),
          }}
          onTouchStart={handleTouchStart('brake')}
          onTouchEnd={handleTouchEnd('brake')}
          onTouchCancel={handleTouchEnd('brake')}
          onContextMenu={preventContextMenu}
        >
          BRAKE
        </button>
      </div>

      {/* Right side - D-pad */}
      <div style={styles.dpadArea as React.CSSProperties}>
        {/* Top row: LF, F, RF */}
        <div style={styles.dpadRow}>
          <button
            style={{
              ...styles.button,
              ...(isActive('forward-left') ? styles.buttonActive : {}),
            }}
            onTouchStart={handleTouchStart('forward-left')}
            onTouchEnd={handleTouchEnd('forward-left')}
            onTouchCancel={handleTouchEnd('forward-left')}
            onContextMenu={preventContextMenu}
          >
            LF
          </button>
          <button
            style={{
              ...styles.button,
              ...(isActive('forward') ? styles.buttonActive : {}),
            }}
            onTouchStart={handleTouchStart('forward')}
            onTouchEnd={handleTouchEnd('forward')}
            onTouchCancel={handleTouchEnd('forward')}
            onContextMenu={preventContextMenu}
          >
            GAS
          </button>
          <button
            style={{
              ...styles.button,
              ...(isActive('forward-right') ? styles.buttonActive : {}),
            }}
            onTouchStart={handleTouchStart('forward-right')}
            onTouchEnd={handleTouchEnd('forward-right')}
            onTouchCancel={handleTouchEnd('forward-right')}
            onContextMenu={preventContextMenu}
          >
            RF
          </button>
        </div>

        {/* Bottom row: L, empty, R */}
        <div style={styles.dpadRow}>
          <button
            style={{
              ...styles.button,
              ...(isActive('left') ? styles.buttonActive : {}),
            }}
            onTouchStart={handleTouchStart('left')}
            onTouchEnd={handleTouchEnd('left')}
            onTouchCancel={handleTouchEnd('left')}
            onContextMenu={preventContextMenu}
          >
            L
          </button>
          <div style={styles.dpadCenter} />
          <button
            style={{
              ...styles.button,
              ...(isActive('right') ? styles.buttonActive : {}),
            }}
            onTouchStart={handleTouchStart('right')}
            onTouchEnd={handleTouchEnd('right')}
            onTouchCancel={handleTouchEnd('right')}
            onContextMenu={preventContextMenu}
          >
            R
          </button>
        </div>
      </div>
    </div>
  )
}
