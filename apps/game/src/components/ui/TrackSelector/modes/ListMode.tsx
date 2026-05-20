import { useMemo, useState } from 'react'
import { listPresetTracks } from '@/constants/tracks'
import { MenuItem } from '../MenuItem'
import { styles } from '../styles'

type Track = {
  id: string
  name: string
  objectCount: number
}

export function ListMode({
  tracks,
  activeTrack,
  onSelectTrack,
  onLoadPreset,
  onNewTrack,
  onRename,
  onDuplicate,
  onDelete,
}: {
  tracks: Track[]
  activeTrack: Track | null
  onSelectTrack: (id: string) => void
  onLoadPreset: (id: string) => void
  onNewTrack: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const presets = useMemo(() => listPresetTracks(), [])

  return (
    <>
      {presets.length > 0 && (
        <div style={styles.menuSection}>
          <div style={styles.menuSectionTitle}>🏎️ F1 Tracks</div>
          {presets.map(preset => (
            <MenuItem
              key={preset.id}
              icon='🏁'
              name={preset.name}
              meta={`${(preset.trackLength / 1000).toFixed(1)}km`}
              isHovered={hoveredItem === preset.id}
              onClick={() => onLoadPreset(preset.id)}
              onMouseEnter={() => setHoveredItem(preset.id)}
              onMouseLeave={() => setHoveredItem(null)}
            />
          ))}
        </div>
      )}

      <div style={styles.menuSection}>
        <div style={styles.menuSectionTitle}>Tracks</div>
        {tracks.length === 0 ? (
          <div style={styles.noTracks}>No tracks yet</div>
        ) : (
          tracks.map(track => (
            <MenuItem
              key={track.id}
              icon={track.id === activeTrack?.id ? '●' : '○'}
              name={track.name}
              meta={`${track.objectCount} obj`}
              isActive={track.id === activeTrack?.id}
              isHovered={hoveredItem === track.id}
              onClick={() => onSelectTrack(track.id)}
              onMouseEnter={() => setHoveredItem(track.id)}
              onMouseLeave={() => setHoveredItem(null)}
            />
          ))
        )}
      </div>

      <div>
        <ActionButton
          icon='+'
          label='New Track'
          isHovered={hoveredItem === 'new'}
          onClick={onNewTrack}
          onMouseEnter={() => setHoveredItem('new')}
          onMouseLeave={() => setHoveredItem(null)}
        />
        {activeTrack && (
          <>
            <ActionButton
              icon='✎'
              label='Rename'
              isHovered={hoveredItem === 'rename'}
              onClick={onRename}
              onMouseEnter={() => setHoveredItem('rename')}
              onMouseLeave={() => setHoveredItem(null)}
            />
            <ActionButton
              icon='⧉'
              label='Duplicate'
              isHovered={hoveredItem === 'duplicate'}
              onClick={onDuplicate}
              onMouseEnter={() => setHoveredItem('duplicate')}
              onMouseLeave={() => setHoveredItem(null)}
            />
            <ActionButton
              icon='✕'
              label='Delete'
              danger
              isHovered={hoveredItem === 'delete'}
              onClick={onDelete}
              onMouseEnter={() => setHoveredItem('delete')}
              onMouseLeave={() => setHoveredItem(null)}
            />
          </>
        )}
      </div>
    </>
  )
}

function ActionButton({
  icon,
  label,
  danger,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  icon: string
  label: string
  danger?: boolean
  isHovered: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <button
      style={{
        ...styles.actionButton,
        ...(danger ? styles.actionButtonDanger : {}),
        ...(isHovered ? styles.menuItemHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span style={styles.menuItemIcon}>{icon}</span>
      {label}
    </button>
  )
}
