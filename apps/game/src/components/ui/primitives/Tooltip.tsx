export function Tooltip({ label, side }: { label: string; side: 'top' | 'bottom' }) {
  const position = side === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
  return (
    <span
      role='tooltip'
      className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[rgba(14,16,22,0.94)] px-2 py-1 text-[11px] font-medium text-white/86 opacity-0 shadow-[0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-opacity delay-150 group-hover:opacity-100 ${position}`}
    >
      {label}
    </span>
  )
}
