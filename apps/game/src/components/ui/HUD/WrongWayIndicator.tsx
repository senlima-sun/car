import { useLapTimeStore } from '../../../stores/useLapTimeStore'

export default function WrongWayIndicator() {
  const wrongWay = useLapTimeStore(s => s.wrongWay)

  if (!wrongWay) return null

  return (
    <div
      className='fixed left-1/2 top-[32%] z-[1000] -translate-x-1/2 -translate-y-1/2 pointer-events-none'
      style={{ animation: 'hud-critical 0.45s ease-in-out infinite' }}
    >
      <div
        className='relative flex items-center gap-4 border-2 border-red-500/70 bg-gradient-to-b from-red-900/80 to-black/85 px-10 py-4 backdrop-blur-md shadow-[0_20px_60px_rgba(239,68,68,0.45)]'
        style={{
          clipPath: 'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%, 0 14px)',
        }}
      >
        <svg width='34' height='34' viewBox='0 0 24 24' fill='none' aria-hidden>
          <path
            d='M12 3 L3 12 L8 12 L8 21 L16 21 L16 12 L21 12 Z'
            fill='#ef4444'
            stroke='#fff'
            strokeWidth='1.25'
            strokeLinejoin='round'
          />
        </svg>
        <div className='flex flex-col leading-none'>
          <span className='text-[10px] font-bold uppercase tracking-[0.42em] text-[#ffb4b4]'>
            Warning
          </span>
          <span className='mt-1 font-sans text-[28px] font-bold uppercase tracking-[0.28em] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.7)]'>
            Wrong Way
          </span>
        </div>
      </div>
    </div>
  )
}
