import { useState, useRef, useEffect, type ReactNode } from 'react'

interface ToolSectionProps {
  children: ReactNode
  popoverContent?: ReactNode
  isOpen?: boolean
  onToggle?: () => void
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  popover: {
    position: 'absolute',
    bottom: 'calc(100% + 12px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(20, 20, 25, 0.95)',
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    zIndex: 200,
  },
  arrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%) rotate(45deg)',
    width: 12,
    height: 12,
    background: 'rgba(20, 20, 25, 0.95)',
    borderRight: '1px solid rgba(255, 255, 255, 0.1)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
}

export default function ToolSection({
  children,
  popoverContent,
  isOpen: controlledIsOpen,
  onToggle,
}: ToolSectionProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Use controlled or internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (onToggle) {
          onToggle()
        } else {
          setInternalOpen(false)
        }
      }
    }

    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onToggle])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (onToggle) {
          onToggle()
        } else {
          setInternalOpen(false)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onToggle])

  return (
    <div ref={containerRef} style={styles.container}>
      {children}
      {isOpen && popoverContent && (
        <div style={styles.popover}>
          <div style={styles.arrow} />
          {popoverContent}
        </div>
      )}
    </div>
  )
}

// Reusable popover header style
export const popoverStyles = {
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold' as const,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    marginTop: 8,
    lineHeight: 1.4,
  },
  toggle: {
    width: 36,
    height: 18,
    borderRadius: 9,
    position: 'relative' as const,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  toggleKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    background: '#fff',
    position: 'absolute' as const,
    top: 2,
    transition: 'left 0.2s ease',
  },
  button: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 'bold' as const,
    transition: 'all 0.2s ease',
  },
}
