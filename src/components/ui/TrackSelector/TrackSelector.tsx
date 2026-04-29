import { useEffect, useRef, useState } from 'react'
import { useTrackStore } from '@/stores/useTrackStore'
import { DeleteMode } from './modes/DeleteMode'
import { InputMode } from './modes/InputMode'
import { ListMode } from './modes/ListMode'
import { styles } from './styles'

type MenuMode = 'list' | 'new' | 'rename' | 'delete'

export default function TrackSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [menuMode, setMenuMode] = useState<MenuMode>('list')
  const [inputValue, setInputValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const trackLibrary = useTrackStore(s => s.trackLibrary)
  const isDirty = useTrackStore(s => s.isDirty)
  const createTrack = useTrackStore(s => s.createTrack)
  const deleteTrack = useTrackStore(s => s.deleteTrack)
  const renameTrack = useTrackStore(s => s.renameTrack)
  const duplicateTrack = useTrackStore(s => s.duplicateTrack)
  const loadTrack = useTrackStore(s => s.loadTrack)
  const loadPresetTrack = useTrackStore(s => s.loadPresetTrack)
  const saveCurrentTrack = useTrackStore(s => s.saveCurrentTrack)
  const getActiveTrack = useTrackStore(s => s.getActiveTrack)
  const loadLibrary = useTrackStore(s => s.loadLibrary)

  const activeTrack = getActiveTrack()
  const tracks = trackLibrary.tracks

  useEffect(() => {
    if (trackLibrary.tracks.length === 0) {
      loadLibrary()
    }
  }, [loadLibrary, trackLibrary.tracks.length])

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

  const handleToggle = () => {
    setIsOpen(!isOpen)
    setMenuMode('list')
    setInputValue('')
  }

  const handleSelectTrack = (id: string) => {
    if (id === activeTrack?.id) return
    if (isDirty && activeTrack) saveCurrentTrack()
    loadTrack(id)
    setIsOpen(false)
  }

  const handleConfirmNew = () => {
    if (isDirty && activeTrack) saveCurrentTrack()
    createTrack(inputValue || 'New Track')
    setMenuMode('list')
    setInputValue('')
    setIsOpen(false)
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
      if (newId) loadTrack(newId)
    }
    setIsOpen(false)
  }

  const handleConfirmDelete = () => {
    if (activeTrack) deleteTrack(activeTrack.id)
    setMenuMode('list')
    setIsOpen(false)
  }

  const handleCancel = () => {
    setMenuMode('list')
    setInputValue('')
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
            <ListMode
              tracks={tracks}
              activeTrack={activeTrack ?? null}
              onSelectTrack={handleSelectTrack}
              onLoadPreset={id => {
                loadPresetTrack(id)
                setIsOpen(false)
              }}
              onNewTrack={() => {
                setMenuMode('new')
                setInputValue('')
              }}
              onRename={() => {
                setMenuMode('rename')
                setInputValue(activeTrack?.name || '')
              }}
              onDuplicate={handleDuplicate}
              onDelete={() => setMenuMode('delete')}
            />
          )}

          {menuMode === 'new' && (
            <InputMode
              title='New Track'
              confirmLabel='Create'
              value={inputValue}
              onChange={setInputValue}
              onConfirm={handleConfirmNew}
              onCancel={handleCancel}
            />
          )}

          {menuMode === 'rename' && (
            <InputMode
              title='Rename Track'
              confirmLabel='Rename'
              value={inputValue}
              onChange={setInputValue}
              onConfirm={handleConfirmRename}
              onCancel={handleCancel}
            />
          )}

          {menuMode === 'delete' && activeTrack && (
            <DeleteMode
              trackName={activeTrack.name}
              onConfirm={handleConfirmDelete}
              onCancel={handleCancel}
            />
          )}
        </div>
      )}
    </div>
  )
}
