import { useMemo, useState } from 'react'
import { PRESET_TRACK_METAS } from '@/constants/tracks'
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
  const [filter, setFilter] = useState('')

  const normalizedFilter = filter.trim().toLowerCase()
  const filteredPresets = useMemo(() => {
    if (!normalizedFilter) return PRESET_TRACK_METAS
    return PRESET_TRACK_METAS.filter(p =>
      p.name.toLowerCase().includes(normalizedFilter),
    )
  }, [normalizedFilter])
  const filteredTracks = useMemo(() => {
    if (!normalizedFilter) return tracks
    return tracks.filter(t => t.name.toLowerCase().includes(normalizedFilter))
  }, [tracks, normalizedFilter])

  return (
    <>
      <input
        type='text'
        placeholder='Search tracks…'
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{ ...styles.input, width: 'calc(100% - 24px)', marginTop: 12 }}
        autoFocus
      />

      {filteredPresets.length > 0 && (
        <div style={styles.menuSection}>
          <div style={styles.menuSectionTitle}>🏎️ F1 Tracks</div>
          {filteredPresets.map(preset => (
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
        {filteredTracks.length === 0 ? (
          <div style={styles.noTracks}>
            {tracks.length === 0 ? 'No tracks yet' : 'No matches'}
          </div>
        ) : (
          filteredTracks.map(track => (
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
