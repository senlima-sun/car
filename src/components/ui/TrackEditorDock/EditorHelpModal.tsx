import { useState } from 'react'

const styles: Record<string, React.CSSProperties> = {
  button: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: 14,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'rgba(20, 20, 25, 0.98)',
    borderRadius: 12,
    padding: 24,
    minWidth: 320,
    maxWidth: 400,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#888',
    cursor: 'pointer',
    fontSize: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  key: {
    minWidth: 60,
    padding: '4px 8px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center' as const,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
}

const shortcuts = [
  {
    section: 'Placement',
    items: [
      { key: 'Click', description: 'Place object / Set point' },
      { key: 'R', description: 'Rotate object 90 degrees' },
      { key: 'Esc', description: 'Cancel current action' },
    ],
  },
  {
    section: 'Editing',
    items: [
      { key: 'Del', description: 'Delete selected object' },
      { key: 'Backspace', description: 'Delete selected object' },
    ],
  },
  {
    section: 'Camera',
    items: [
      { key: 'WASD', description: 'Pan camera' },
      { key: 'Scroll', description: 'Zoom in/out' },
    ],
  },
  { section: 'Mode', items: [{ key: 'T', description: 'Toggle editor / race mode' }] },
]

export default function EditorHelpModal() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button style={styles.button} onClick={() => setIsOpen(true)} title='Keyboard shortcuts'>
        ?
      </button>

      {isOpen && (
        <div style={styles.overlay} onClick={() => setIsOpen(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.header}>
              <span style={styles.title}>Editor Shortcuts</span>
              <button style={styles.closeButton} onClick={() => setIsOpen(false)}>
                x
              </button>
            </div>

            {shortcuts.map(section => (
              <div key={section.section} style={styles.section}>
                <div style={styles.sectionTitle}>{section.section}</div>
                {section.items.map(item => (
                  <div key={item.key} style={styles.row}>
                    <span style={styles.key}>{item.key}</span>
                    <span style={styles.description}>{item.description}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
