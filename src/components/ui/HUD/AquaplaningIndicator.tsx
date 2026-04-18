import { useAquaplaningStore } from '../../../stores/useAquaplaningStore'

export default function AquaplaningIndicator() {
  const isAquaplaning = useAquaplaningStore(s => s.isAquaplaning)
  const isThermalShock = useAquaplaningStore(s => s.isThermalShock)
  const thermalShockPenalty = useAquaplaningStore(s => s.thermalShockPenalty)
  const thermalShockRecoveryTime = useAquaplaningStore(s => s.thermalShockRecoveryTime)

  if (!isAquaplaning && !isThermalShock) return null

  return (
    <div className='fixed top-[22%] left-1/2 z-[100] -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none'>
      {isAquaplaning && (
        <div
          className='relative border border-red-500/60 bg-gradient-to-b from-red-900/80 to-black/80 px-8 py-3 backdrop-blur-md shadow-[0_14px_40px_rgba(239,68,68,0.35)]'
          style={{
            clipPath: 'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%, 0 12px)',
            animation: 'hud-critical 0.8s ease-in-out infinite',
          }}
        >
          <div className='text-center text-[10px] font-bold uppercase tracking-[0.42em] text-[#ef4444]'>
            Warning
          </div>
          <div className='mt-1 font-sans text-[24px] font-bold uppercase tracking-[0.28em] text-white'>
            Aquaplaning
          </div>
        </div>
      )}

      {isThermalShock && (
        <div
          className='relative border border-[#60a5fa]/60 bg-gradient-to-b from-blue-950/80 to-black/80 px-6 py-2 backdrop-blur-md shadow-[0_12px_30px_rgba(96,165,250,0.25)]'
          style={{
            clipPath: 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)',
          }}
        >
          <div className='text-center text-[9px] font-bold uppercase tracking-[0.32em] text-[#60a5fa]'>
            Tire Thermal Shock
          </div>
          <div className='mt-1 flex items-center justify-center gap-3 font-mono text-[11px] tabular-nums text-white/85'>
            <span>
              <span className='text-white/45'>Grip </span>
              <span className='font-bold text-[#ef4444]'>−{Math.round(thermalShockPenalty * 100)}%</span>
            </span>
            <span className='h-3 w-px bg-white/20' />
            <span>
              <span className='text-white/45'>Recover </span>
              <span className='font-bold text-white'>{thermalShockRecoveryTime.toFixed(1)}s</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
