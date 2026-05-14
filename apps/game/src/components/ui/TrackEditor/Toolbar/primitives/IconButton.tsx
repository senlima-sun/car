import type { ReactNode } from 'react'
import { Tooltip } from './Tooltip'

export function IconButton({
  active,
  disabled,
  primary,
  danger,
  onClick,
  title,
  tooltipSide = 'bottom',
  children,
}: {
  active?: boolean
  disabled?: boolean
  primary?: boolean
  danger?: boolean
  onClick: () => void
  title: string
  tooltipSide?: 'top' | 'bottom'
  children: ReactNode
}) {
  const base =
    'group relative inline-flex h-9 w-9 items-center justify-center rounded-full transition'
  const style = disabled
    ? 'cursor-not-allowed text-white/28'
    : primary
      ? 'bg-sky-500/22 text-white hover:bg-sky-500/32'
      : danger
        ? 'text-red-200/86 hover:bg-red-500/18 hover:text-red-50'
        : active
          ? 'bg-white/[0.12] text-white'
          : 'text-white/66 hover:bg-white/[0.08] hover:text-white'
  return (
    <button aria-label={title} className={`${base} ${style}`} disabled={disabled} onClick={onClick}>
      {children}
      {!disabled && <Tooltip label={title} side={tooltipSide} />}
    </button>
  )
}
