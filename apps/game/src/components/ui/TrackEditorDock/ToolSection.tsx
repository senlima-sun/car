import { type ReactNode } from 'react'

interface Props {
  isOpen: boolean
  onToggle: () => void
  popoverContent: ReactNode
  children: ReactNode
}

const containerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  left: 0,
  minWidth: 240,
  padding: 12,
  borderRadius: 8,
  background: 'rgba(15, 15, 15, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  color: '#fff',
  fontSize: 11,
  zIndex: 50,
}

export const popoverStyles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 10,
  },
  hint: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    lineHeight: 1.4,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
  },
  label: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  toggle: {
    width: 28,
    height: 16,
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    transition: 'background 0.15s ease',
  },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.15s ease',
  },
}

export default function ToolSection({ isOpen, onToggle: _onToggle, popoverContent, children }: Props) {
  return (
    <div style={containerStyle}>
      {children}
      {isOpen && <div style={popoverStyle}>{popoverContent}</div>}
    </div>
  )
}
