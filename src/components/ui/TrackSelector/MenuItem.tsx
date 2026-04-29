import { styles } from './styles'

export function MenuItem({
  icon,
  name,
  meta,
  isActive,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  icon: string
  name: string
  meta?: string
  isActive?: boolean
  isHovered: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      style={{
        ...styles.menuItem,
        ...(isActive ? styles.menuItemActive : {}),
        ...(isHovered && !isActive ? styles.menuItemHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span style={styles.menuItemIcon}>{icon}</span>
      <span style={styles.menuItemName}>{name}</span>
      {meta && <span style={styles.menuItemMeta}>{meta}</span>}
    </div>
  )
}
