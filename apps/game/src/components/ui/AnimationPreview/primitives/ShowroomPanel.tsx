import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'

export function HoverBadge({ children }: { children: ReactNode }) {
  return (
    <div className='pointer-events-none absolute left-4 top-16 z-[100] rounded-lg border border-red-300/30 bg-black/70 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-red-100 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:left-40 sm:top-5'>
      {children}
    </div>
  )
}

export function ShowroomHud({ children }: { children: ReactNode }) {
  return <div className='pointer-events-none absolute inset-0 z-[100]'>{children}</div>
}

export function ShowroomToolbar({ children }: { children: ReactNode }) {
  return (
    <div className='pointer-events-auto absolute left-4 top-4 flex items-center gap-1 rounded-full border border-white/10 bg-black/72 p-1 shadow-[0_16px_42px_rgba(0,0,0,0.38)] backdrop-blur-xl'>
      {children}
    </div>
  )
}

export function ToolButton({
  active,
  danger,
  icon: Icon,
  title,
  onClick,
}: {
  active?: boolean
  danger?: boolean
  icon: LucideIcon
  title: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={title}
      title={title}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
        danger
          ? 'text-red-200/86 hover:bg-red-500/18 hover:text-red-50'
          : active
            ? 'bg-white/[0.12] text-white'
            : 'text-white/66 hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      <Icon size={16} strokeWidth={1.8} />
    </button>
  )
}

export function Popover({
  title,
  meta,
  onClose,
  children,
}: {
  title: string
  meta?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className='pointer-events-auto absolute left-4 right-4 top-16 max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(14,16,22,0.94)] shadow-[0_16px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:right-auto sm:max-h-[560px] sm:w-[326px]'>
      <div className='flex items-center gap-3 border-b border-white/8 px-3 py-2'>
        <div className='min-w-0 flex-1'>
          <div className='truncate font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/82'>
            {title}
          </div>
          {meta && (
            <div className='mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.18em] text-white/38'>
              {meta}
            </div>
          )}
        </div>
        <button
          aria-label='Close'
          title='Close'
          onClick={onClose}
          className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/[0.08] hover:text-white'
        >
          <X size={15} strokeWidth={1.8} />
        </button>
      </div>
      <div className='showroom-scroll max-h-[calc(100vh-8.5rem)] overflow-y-auto p-2.5 sm:max-h-[500px]'>
        {children}
      </div>
    </div>
  )
}

export function PartMenu({ children }: { children: ReactNode }) {
  return <div className='grid grid-cols-2 gap-1.5'>{children}</div>
}

export function PartOption({
  label,
  color,
  active,
  highlighted,
  onClick,
}: {
  label: string
  color?: string
  active?: boolean
  highlighted?: boolean
  onClick: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`flex h-10 min-w-0 items-center gap-1.5 rounded-lg border px-2 text-left transition ${
        active
          ? 'border-red-300/60 bg-red-400/15 text-red-100'
          : highlighted
            ? 'border-white/30 bg-white/[0.08] text-white'
            : 'border-white/10 bg-white/[0.03] text-white/68 hover:border-white/25 hover:text-white'
      }`}
    >
      {color && (
        <span
          className='h-2 w-2 shrink-0 rounded-full border border-white/25'
          style={{ backgroundColor: color }}
        />
      )}
      <span className='min-w-0 truncate font-mono text-[9px] uppercase'>{label}</span>
    </button>
  )
}

export function SelectedPartBadge({ children }: { children: ReactNode }) {
  return (
    <div className='mb-2 flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2'>
      <span className='font-mono text-[9px] uppercase tracking-[0.2em] text-white/40'>Editing</span>
      <span className='min-w-0 truncate pl-3 text-right font-mono text-[10px] uppercase text-white/78'>
        {children}
      </span>
    </div>
  )
}

export function GlobalSettingsGrid({ children }: { children: ReactNode }) {
  return <div className='grid grid-cols-1 gap-1 border-t border-white/5'>{children}</div>
}

export function SwatchButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string
  color: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`aspect-square w-full cursor-pointer rounded-md border transition hover:scale-105 ${
        active
          ? 'border-red-300/70 ring-2 ring-red-300/40 ring-offset-1 ring-offset-black/60'
          : 'border-white/10 hover:border-white/30'
      }`}
      style={{ backgroundColor: color }}
    />
  )
}
