import type { CSSProperties, ReactNode } from 'react'

export const HUD_CLIP_STANDARD =
  'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)'
export const HUD_CLIP_LEFT = 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)'
export const HUD_CLIP_RIGHT = 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)'
export const HUD_DIVIDER_CLASS =
  'w-px self-stretch bg-gradient-to-b from-transparent via-white/14 to-transparent'
export const HUD_LABEL_CLASS = 'text-[8px] font-semibold uppercase tracking-[0.32em] text-white/45'
export const HUD_PANEL_CLASS =
  'relative overflow-hidden border border-white/10 backdrop-blur-md shadow-[0_18px_55px_rgba(0,0,0,0.52)]'

type HudPanelProps = {
  children: ReactNode
  accent?: string
  className?: string
  contentClassName?: string
  clipPath?: string
  edge?: 'left' | 'right' | 'none'
  style?: CSSProperties
}

function joinClasses(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function HudPanel({
  children,
  accent = '#ffcc00',
  className,
  contentClassName,
  clipPath = HUD_CLIP_STANDARD,
  edge = 'none',
  style,
}: HudPanelProps) {
  const edgeClass =
    edge === 'left'
      ? 'left-0 top-0 h-full w-[3px]'
      : edge === 'right'
        ? 'right-0 top-0 h-full w-[3px]'
        : ''

  return (
    <div
      className={joinClasses(HUD_PANEL_CLASS, className)}
      style={{
        clipPath,
        background:
          'linear-gradient(180deg, rgba(14,18,25,0.9) 0%, rgba(7,10,15,0.82) 55%, rgba(3,5,9,0.92) 100%)',
        boxShadow: `0 18px 55px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.05)`,
        ...style,
      }}
    >
      <div
        className='pointer-events-none absolute inset-0 opacity-90'
        style={{
          background:
            'radial-gradient(circle at top center, rgba(255,255,255,0.08), transparent 42%), linear-gradient(90deg, rgba(255,255,255,0.03), transparent 26%, transparent 74%, rgba(255,255,255,0.02))',
        }}
      />
      <div
        className='pointer-events-none absolute inset-x-3 top-0 h-[2px]'
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0.72,
        }}
      />
      {edge !== 'none' && (
        <div
          className={joinClasses('pointer-events-none absolute', edgeClass)}
          style={{ background: accent, boxShadow: `0 0 14px ${accent}` }}
        />
      )}
      <div className={joinClasses('relative', contentClassName)}>{children}</div>
    </div>
  )
}
