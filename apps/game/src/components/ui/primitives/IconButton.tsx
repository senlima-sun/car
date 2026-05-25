import type { ReactNode } from 'react'
import { iconBtnBase, iconBtnVariant } from './tokens'
import { Tooltip } from './Tooltip'

type IconButtonProps = {
  active?: boolean
  disabled?: boolean
  primary?: boolean
  danger?: boolean
  onClick: () => void
  title: string
  tooltipSide?: 'top' | 'bottom'
  children: ReactNode
}

export function resolveIconBtnVariant({
  disabled,
  primary,
  danger,
  active,
}: Pick<IconButtonProps, 'disabled' | 'primary' | 'danger' | 'active'>) {
  if (disabled) return iconBtnVariant.disabled
  if (primary) return iconBtnVariant.primary
  if (danger) return iconBtnVariant.danger
  if (active) return iconBtnVariant.active
  return iconBtnVariant.default
}

export function IconButton({
  active,
  disabled,
  primary,
  danger,
  onClick,
  title,
  tooltipSide = 'bottom',
  children,
}: IconButtonProps) {
  const variant = resolveIconBtnVariant({ disabled, primary, danger, active })
  return (
    <button
      aria-label={title}
      className={`${iconBtnBase} ${variant}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      {!disabled && <Tooltip label={title} side={tooltipSide} />}
    </button>
  )
}
