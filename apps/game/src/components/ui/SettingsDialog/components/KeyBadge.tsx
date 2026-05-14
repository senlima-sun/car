export function KeyBadge({ keyName }: { keyName: string }) {
  return (
    <span className='bg-white/15 px-2.5 py-1.5 rounded font-mono text-[11px] font-bold text-white min-w-[24px] text-center shadow-[0_2px_0_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10'>
      {keyName}
    </span>
  )
}
