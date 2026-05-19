import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

export function HoverBadge({ children }: { children: ReactNode }) {
  return (
    <div className='pointer-events-none absolute left-6 top-6 z-[100] rounded-lg border border-red-300/30 bg-black/70 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-red-100 shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl'>
      {children}
    </div>
  )
}

export function PanelShell({ children }: { children: ReactNode }) {
  return (
    <div className='pointer-events-auto absolute left-4 right-4 top-4 bottom-4 z-[100] flex w-auto flex-col overflow-hidden rounded-xl border border-white/10 bg-black/72 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:left-auto sm:w-[420px]'>
      {children}
    </div>
  )
}

export function PanelHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className='relative border-b border-white/8 px-3.5 pt-3 pb-2.5'>
      <div className='flex items-center gap-2.5'>
        <span className='inline-block h-px w-[22px] bg-red-400/70' />
        <span className='font-mono text-[9px] uppercase tracking-[0.36em] text-red-300/80'>
          F1 · 2026
        </span>
        <span className='ml-auto flex items-center gap-1.5'>
          <span className='h-1.5 w-1.5 rounded-full bg-red-400' />
          <span className='font-mono text-[9px] uppercase tracking-[0.28em] text-white/30'>F2</span>
        </span>
      </div>
      <div className='mt-1.5 flex min-w-0 items-baseline justify-between gap-3'>
        <h2 className='font-mono text-[15px] font-semibold uppercase tracking-[0.18em] text-white'>
          {title}
        </h2>
        <span className='min-w-0 truncate text-right font-mono text-[9px] uppercase tracking-[0.24em] text-white/35'>
          {meta}
        </span>
      </div>
    </div>
  )
}

export function PanelBody({ children }: { children: ReactNode }) {
  return (
    <div className='grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(120px,170px)_minmax(0,1fr)] gap-2 overflow-hidden p-2.5 sm:grid-cols-[128px_minmax(0,1fr)] sm:grid-rows-none'>
      {children}
    </div>
  )
}

export function PartRail({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-0 overflow-y-auto rounded-lg border border-white/8 bg-white/[0.025] p-2'>
      <div className='mb-2 flex items-center justify-between px-1'>
        <span className='font-mono text-[9px] uppercase tracking-[0.28em] text-red-200/70'>
          Parts
        </span>
      </div>
      <div className='space-y-1'>{children}</div>
    </div>
  )
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
      className={`flex w-full items-center gap-1 rounded-md border px-1.5 py-1.5 text-left transition ${
        active
          ? 'border-red-300/60 bg-red-400/15 text-red-100'
          : highlighted
            ? 'border-white/30 bg-white/[0.08] text-white'
            : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white'
      }`}
    >
      {color && (
        <span
          className='h-1.5 w-1.5 shrink-0 rounded-full border border-white/25'
          style={{ backgroundColor: color }}
        />
      )}
      <span className='min-w-0 truncate font-mono text-[8px] uppercase'>{label}</span>
    </button>
  )
}

export function PanelScrollArea({ children }: { children: ReactNode }) {
  return <div className='showroom-scroll min-h-0 overflow-y-auto pr-1'>{children}</div>
}

export function PanelSectionGrid({ children }: { children: ReactNode }) {
  return <div className='grid grid-cols-1 gap-2 border-t border-white/5 pt-2'>{children}</div>
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

export function PanelFooter({ onBack }: { onBack: () => void }) {
  return (
    <div className='border-t border-white/8 px-4 py-3'>
      <button
        onClick={onBack}
        className='group flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-red-300/50 hover:bg-red-500/10 focus-visible:border-red-300/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-300/40'
      >
        <span className='flex items-center gap-2'>
          <ArrowLeft
            size={13}
            className='text-white/35 transition group-hover:-translate-x-1 group-hover:text-red-200'
          />
          <span className='font-mono text-[11px] uppercase tracking-[0.24em] text-white/85 group-hover:text-red-100'>
            Back
          </span>
        </span>
        <span className='rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/40 group-hover:border-red-300/40 group-hover:text-red-200/80'>
          F2
        </span>
      </button>
    </div>
  )
}
