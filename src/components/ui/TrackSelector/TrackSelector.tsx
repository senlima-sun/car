import { useState, useRef, useEffect } from 'react'
import { useTrackStore } from '../../../stores/useTrackStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: 'rgba(0, 0, 0, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    minWidth: 180,
    transition: 'all 0.2s ease',
  },
  dropdownButtonHover: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    background: 'rgba(0, 0, 0, 0.9)',
  },
  trackName: {
    flex: 1,
    textAlign: 'left' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  arrow: {
    fontSize: 10,
    opacity: 0.7,
    transition: 'transform 0.2s ease',
  },
  arrowOpen: {
    transform: 'rotate(180deg)',
  },
  menu: {
    position: 'absolute' as const,
    top: 'calc(100% + 4px)',
    left: 0,
    minWidth: 250,
    background: 'rgba(0, 0, 0, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  menuSection: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  menuSectionTitle: {
    padding: '8px 12px',
    fontSize: 10,
    textTransform: 'uppercase' as const,
    color: '#666',
    fontWeight: 600,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    fontSize: 13,
  },
  menuItemActive: {
    background: 'rgba(59, 130, 246, 0.3)',
  },
  menuItemHover: {
    background: 'rgba(255, 255, 255, 0.1)',
  },
  menuItemIcon: {
    width: 18,
    textAlign: 'center' as const,
    opacity: 0.7,
  },
  menuItemName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  menuItemMeta: {
    fontSize: 11,
    color: '#666',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    fontSize: 13,
    textAlign: 'left' as const,
  },
  actionButtonDanger: {
    color: '#ef4444',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    margin: '0 12px 12px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  confirmButtons: {
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
  },
  confirmButton: {
    flex: 1,
    padding: '6px 12px',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  confirmButtonPrimary: {
    background: '#3b82f6',
    color: '#fff',
  },
  confirmButtonSecondary: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
  confirmButtonDanger: {
    background: '#ef4444',
    color: '#fff',
  },
  noTracks: {
    padding: '20px 12px',
    textAlign: 'center' as const,
    color: '#666',
    fontSize: 13,
  },
}

type MenuMode = 'list' | 'new' | 'rename' | 'delete'

export default function TrackSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [menuMode, setMenuMode] = useState<MenuMode>('list')
  const [inputValue, setInputValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trackLibrary = useTrackStore(s => s.trackLibrary)
  const isDirty = useTrackStore(s => s.isDirty)
  const createTrack = useTrackStore(s => s.createTrack)
  const deleteTrack = useTrackStore(s => s.deleteTrack)
  const renameTrack = useTrackStore(s => s.renameTrack)
  const duplicateTrack = useTrackStore(s => s.duplicateTrack)
  const loadTrack = useTrackStore(s => s.loadTrack)
  const saveCurrentTrack = useTrackStore(s => s.saveCurrentTrack)
  const getActiveTrack = useTrackStore(s => s.getActiveTrack)

  const activeTrack = getActiveTrack()
  const tracks = trackLibrary.tracks

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setMenuMode('list')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Focus input when entering new/rename mode
  useEffect(() => {
    if ((menuMode === 'new' || menuMode === 'rename') && inputRef.current) {
      inputRef.current.focus()
    }
  }, [menuMode])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    setMenuMode('list')
    setInputValue('')
  }

  const handleSelectTrack = (id: string) => {
    if (id === activeTrack?.id) return

    // Save current track before switching if dirty
    if (isDirty && activeTrack) {
      saveCurrentTrack()
    }

    loadTrack(id)
    setIsOpen(false)
  }

  const handleNewTrack = () => {
    setMenuMode('new')
    setInputValue('')
  }

  const handleConfirmNew = () => {
    if (isDirty && activeTrack) {
      saveCurrentTrack()
    }
    createTrack(inputValue || 'New Track')
    setMenuMode('list')
    setInputValue('')
    setIsOpen(false)
  }

  const handleRename = () => {
    setMenuMode('rename')
    setInputValue(activeTrack?.name || '')
  }

  const handleConfirmRename = () => {
    if (activeTrack && inputValue.trim()) {
      renameTrack(activeTrack.id, inputValue)
    }
    setMenuMode('list')
    setInputValue('')
  }

  const handleDuplicate = () => {
    if (activeTrack) {
      saveCurrentTrack()
      const newId = duplicateTrack(activeTrack.id, `${activeTrack.name} (Copy)`)
      if (newId) {
        loadTrack(newId)
      }
    }
    setIsOpen(false)
  }

  const handleDelete = () => {
    setMenuMode('delete')
  }

  const handleConfirmDelete = () => {
    if (activeTrack) {
      deleteTrack(activeTrack.id)
    }
    setMenuMode('list')
    setIsOpen(false)
  }

  const handleCancel = () => {
    setMenuMode('list')
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (menuMode === 'new') handleConfirmNew()
      else if (menuMode === 'rename') handleConfirmRename()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <div style={styles.container} ref={menuRef}>
      <button
        style={{
          ...styles.dropdownButton,
          ...(isHovered || isOpen ? styles.dropdownButtonHover : {}),
        }}
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span style={styles.trackName}>
          {activeTrack ? activeTrack.name : 'No Track Selected'}
          {isDirty && ' *'}
        </span>
        <span style={{ ...styles.arrow, ...(isOpen ? styles.arrowOpen : {}) }}>▼</span>
      </button>

      {isOpen && (
        <div style={styles.menu}>
          {menuMode === 'list' && (
            <>
              {/* Track List */}
              <div style={styles.menuSection}>
                <div style={styles.menuSectionTitle}>Tracks</div>
                {tracks.length === 0 ? (
                  <div style={styles.noTracks}>No tracks yet</div>
                ) : (
                  tracks.map(track => (
                    <div
                      key={track.id}
                      style={{
                        ...styles.menuItem,
                        ...(track.id === activeTrack?.id ? styles.menuItemActive : {}),
                        ...(hoveredItem === track.id && track.id !== activeTrack?.id
                          ? styles.menuItemHover
                          : {}),
                      }}
                      onClick={() => handleSelectTrack(track.id)}
                      onMouseEnter={() => setHoveredItem(track.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <span style={styles.menuItemIcon}>
                        {track.id === activeTrack?.id ? '●' : '○'}
                      </span>
                      <span style={styles.menuItemName}>{track.name}</span>
                      <span style={styles.menuItemMeta}>{track.objectCount} obj</span>
                    </div>
                  ))
                )}
              </div>

              {/* Actions */}
              <div>
                <button
                  style={{
                    ...styles.actionButton,
                    ...(hoveredItem === 'new' ? styles.menuItemHover : {}),
                  }}
                  onClick={handleNewTrack}
                  onMouseEnter={() => setHoveredItem('new')}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <span style={styles.menuItemIcon}>+</span>
                  New Track
                </button>

                {activeTrack && (
                  <>
                    <button
                      style={{
                        ...styles.actionButton,
                        ...(hoveredItem === 'rename' ? styles.menuItemHover : {}),
                      }}
                      onClick={handleRename}
                      onMouseEnter={() => setHoveredItem('rename')}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <span style={styles.menuItemIcon}>✎</span>
                      Rename
                    </button>
                    <button
                      style={{
                        ...styles.actionButton,
                        ...(hoveredItem === 'duplicate' ? styles.menuItemHover : {}),
                      }}
                      onClick={handleDuplicate}
                      onMouseEnter={() => setHoveredItem('duplicate')}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <span style={styles.menuItemIcon}>⧉</span>
                      Duplicate
                    </button>
                    <button
                      style={{
                        ...styles.actionButton,
                        ...styles.actionButtonDanger,
                        ...(hoveredItem === 'delete' ? styles.menuItemHover : {}),
                      }}
                      onClick={handleDelete}
                      onMouseEnter={() => setHoveredItem('delete')}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <span style={styles.menuItemIcon}>✕</span>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {menuMode === 'new' && (
            <div style={{ padding: '12px 0' }}>
              <div style={styles.menuSectionTitle}>New Track</div>
              <input
                ref={inputRef}
                style={{ ...styles.input, width: 'calc(100% - 24px)' }}
                type='text'
                placeholder='Track name...'
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div style={styles.confirmButtons}>
                <button
                  style={{ ...styles.confirmButton, ...styles.confirmButtonSecondary }}
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  style={{ ...styles.confirmButton, ...styles.confirmButtonPrimary }}
                  onClick={handleConfirmNew}
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {menuMode === 'rename' && (
            <div style={{ padding: '12px 0' }}>
              <div style={styles.menuSectionTitle}>Rename Track</div>
              <input
                ref={inputRef}
                style={{ ...styles.input, width: 'calc(100% - 24px)' }}
                type='text'
                placeholder='Track name...'
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div style={styles.confirmButtons}>
                <button
                  style={{ ...styles.confirmButton, ...styles.confirmButtonSecondary }}
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  style={{ ...styles.confirmButton, ...styles.confirmButtonPrimary }}
                  onClick={handleConfirmRename}
                >
                  Rename
                </button>
              </div>
            </div>
          )}

          {menuMode === 'delete' && (
            <div style={{ padding: '12px 0' }}>
              <div style={styles.menuSectionTitle}>Delete Track</div>
              <div style={{ padding: '8px 12px', color: '#ccc', fontSize: 13 }}>
                Are you sure you want to delete "{activeTrack?.name}"?
              </div>
              <div style={styles.confirmButtons}>
                <button
                  style={{ ...styles.confirmButton, ...styles.confirmButtonSecondary }}
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  style={{ ...styles.confirmButton, ...styles.confirmButtonDanger }}
                  onClick={handleConfirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
